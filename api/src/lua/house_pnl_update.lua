--[[
  House PnL Update Lua Script

  Atomically updates monthly total and per-game house PnL aggregates.

  KEYS:
    1. periodKey - Monthly total hash key
    2. gameKey - Monthly per-game hash key
    3. dedupeKey - Result id key
    4..n. cache keys to delete

  ARGV:
    1. resultId
    2. game
    3. housePnlWei
    4. betAmountWei
    5. payoutWei
    6. timestampIso
    7. dedupeTtlSeconds
    8. feeWei

  Returns:
    { appliedFlag, totalHousePnlWei, gameHousePnlWei }
]]

local periodKey = KEYS[1]
local gameKey = KEYS[2]
local dedupeKey = KEYS[3]

local resultId = ARGV[1]
local game = ARGV[2]
local housePnlWei = ARGV[3]
local betAmountWei = ARGV[4]
local payoutWei = ARGV[5]
local timestampIso = ARGV[6]
local dedupeTtlSeconds = tonumber(ARGV[7]) or 2592000
local feeWei = ARGV[8] or '0'

local function stripSign(value)
  if string.sub(value, 1, 1) == '-' then
    return '-', string.sub(value, 2)
  end
  return '', value
end

local function stripLeadingZeros(value)
  value = string.gsub(value or '0', '^0+', '')
  if value == '' then
    return '0'
  end
  return value
end

local function normalize(value)
  local sign, digits = stripSign(tostring(value or '0'))
  digits = stripLeadingZeros(digits)
  if digits == '0' then
    return '0'
  end
  return sign .. digits
end

local function compareAbs(a, b)
  a = stripLeadingZeros(a)
  b = stripLeadingZeros(b)
  if string.len(a) > string.len(b) then return 1 end
  if string.len(a) < string.len(b) then return -1 end
  if a > b then return 1 end
  if a < b then return -1 end
  return 0
end

local function addAbs(a, b)
  local carry = 0
  local result = {}
  local i = string.len(a)
  local j = string.len(b)

  while i > 0 or j > 0 or carry > 0 do
    local da = 0
    local db = 0
    if i > 0 then
      da = tonumber(string.sub(a, i, i))
      i = i - 1
    end
    if j > 0 then
      db = tonumber(string.sub(b, j, j))
      j = j - 1
    end
    local sum = da + db + carry
    table.insert(result, 1, tostring(sum % 10))
    carry = math.floor(sum / 10)
  end

  return stripLeadingZeros(table.concat(result))
end

local function subAbs(a, b)
  local borrow = 0
  local result = {}
  local i = string.len(a)
  local j = string.len(b)

  while i > 0 do
    local da = tonumber(string.sub(a, i, i)) - borrow
    local db = 0
    if j > 0 then
      db = tonumber(string.sub(b, j, j))
      j = j - 1
    end
    if da < db then
      da = da + 10
      borrow = 1
    else
      borrow = 0
    end
    table.insert(result, 1, tostring(da - db))
    i = i - 1
  end

  return stripLeadingZeros(table.concat(result))
end

local function addDecimalStrings(a, b)
  a = normalize(a)
  b = normalize(b)

  local signA, absA = stripSign(a)
  local signB, absB = stripSign(b)
  absA = stripLeadingZeros(absA)
  absB = stripLeadingZeros(absB)

  if signA == signB then
    local sum = addAbs(absA, absB)
    if sum == '0' then return '0' end
    return signA .. sum
  end

  local cmp = compareAbs(absA, absB)
  if cmp == 0 then
    return '0'
  elseif cmp > 0 then
    local diff = subAbs(absA, absB)
    if diff == '0' then return '0' end
    return signA .. diff
  else
    local diff = subAbs(absB, absA)
    if diff == '0' then return '0' end
    return signB .. diff
  end
end

local function hgetOrZero(key, field)
  local value = redis.call('HGET', key, field)
  if value == false or value == nil then
    return '0'
  end
  return value
end

if resultId ~= '' then
  local didSet = redis.call('SET', dedupeKey, '1', 'NX', 'EX', dedupeTtlSeconds)
  if not didSet then
    return {0, hgetOrZero(periodKey, 'housePnlWei'), hgetOrZero(gameKey, 'housePnlWei')}
  end
end

local totalHousePnl = addDecimalStrings(hgetOrZero(periodKey, 'housePnlWei'), housePnlWei)
local totalFee = addDecimalStrings(hgetOrZero(periodKey, 'feeWei'), feeWei)
local totalWagered = addDecimalStrings(hgetOrZero(periodKey, 'wageredWei'), betAmountWei)
local totalPayout = addDecimalStrings(hgetOrZero(periodKey, 'payoutWei'), payoutWei)
local totalGrossPnl = totalHousePnl

redis.call('HSET', periodKey,
  'housePnlWei', totalHousePnl,
  'grossPnlWei', totalGrossPnl,
  'feeWei', totalFee,
  'wageredWei', totalWagered,
  'payoutWei', totalPayout,
  'updatedAt', timestampIso,
  'pnlVersion', 'cash-v2'
)
redis.call('HINCRBY', periodKey, 'games', 1)

local gameHousePnl = addDecimalStrings(hgetOrZero(gameKey, 'housePnlWei'), housePnlWei)
local gameFee = addDecimalStrings(hgetOrZero(gameKey, 'feeWei'), feeWei)
local gameWagered = addDecimalStrings(hgetOrZero(gameKey, 'wageredWei'), betAmountWei)
local gamePayout = addDecimalStrings(hgetOrZero(gameKey, 'payoutWei'), payoutWei)
local gameGrossPnl = gameHousePnl

redis.call('HSET', gameKey,
  'game', game,
  'housePnlWei', gameHousePnl,
  'grossPnlWei', gameGrossPnl,
  'feeWei', gameFee,
  'wageredWei', gameWagered,
  'payoutWei', gamePayout,
  'updatedAt', timestampIso,
  'pnlVersion', 'cash-v2'
)
redis.call('HINCRBY', gameKey, 'games', 1)

for i = 4, #KEYS do
  redis.call('DEL', KEYS[i])
end

return {1, totalHousePnl, gameHousePnl}
