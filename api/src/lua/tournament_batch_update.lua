--[[
  Tournament Batch Update Lua Script
  
  Atomically updates multiple player stats at once.
  Used for batch processing of buffered events.
  
  KEYS:
    1. totalPnlLbKey - Total PnL leaderboard sorted set
    2. totalVolLbKey - Total Volume leaderboard sorted set
    
  ARGV:
    Repeating pattern for each player (7 args per player):
    - playerId
    - playerKey (full Redis key)
    - pnlDelta
    - volumeDelta  
    - weightedVolumeDelta
    - gamesCount
    - winsCount
    
  First ARGV is the count of players
    
  Returns:
    Count of updated players
]]

local totalPnlLbKey = KEYS[1]
local totalVolLbKey = KEYS[2]

local playerCount = tonumber(ARGV[1])
local ARGS_PER_PLAYER = 7

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

local function addBigInt(a, b)
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
  local val = redis.call('HGET', key, field)
  if val == false or val == nil then
    return "0"
  end
  return val
end

local updatedCount = 0

for i = 0, playerCount - 1 do
  local baseIdx = 2 + (i * ARGS_PER_PLAYER)
  
  local playerId = ARGV[baseIdx]
  local playerKey = ARGV[baseIdx + 1]
  local pnlDelta = ARGV[baseIdx + 2]
  local volumeDelta = ARGV[baseIdx + 3]
  local weightedVolumeDelta = ARGV[baseIdx + 4]
  local gamesCount = tonumber(ARGV[baseIdx + 5]) or 1
  local winsCount = tonumber(ARGV[baseIdx + 6]) or 0
  
  -- Check if player exists
  local exists = redis.call('EXISTS', playerKey)
  
  if exists == 0 then
    -- Create new player entry with minimal data
    redis.call('HSET', playerKey,
      'playerId', playerId,
      'totalPnl', pnlDelta,
      'totalVolume', volumeDelta,
      'weightedVolume', weightedVolumeDelta,
      'totalGames', gamesCount,
      'wins', winsCount,
      'wallets', '[]',
      'games', '{}'
    )
  else
    -- Update existing player
    local currentPnl = hgetOrZero(playerKey, 'totalPnl')
    local currentVolume = hgetOrZero(playerKey, 'totalVolume')
    local currentWeightedVolume = hgetOrZero(playerKey, 'weightedVolume')
    local currentGames = tonumber(hgetOrZero(playerKey, 'totalGames')) or 0
    local currentWins = tonumber(hgetOrZero(playerKey, 'wins')) or 0
    
    redis.call('HSET', playerKey,
      'totalPnl', addBigInt(currentPnl, pnlDelta),
      'totalVolume', addBigInt(currentVolume, volumeDelta),
      'weightedVolume', addBigInt(currentWeightedVolume, weightedVolumeDelta),
      'totalGames', currentGames + gamesCount,
      'wins', currentWins + winsCount
    )
  end
  
  -- Get final totals for leaderboard
  local finalPnl = hgetOrZero(playerKey, 'totalPnl')
  local finalWeightedVolume = hgetOrZero(playerKey, 'weightedVolume')
  
  -- Update leaderboards
  local pnlScore = tonumber(finalPnl) / 1e18
  local volScore = tonumber(finalWeightedVolume) / 1e18
  
  redis.call('ZADD', totalPnlLbKey, pnlScore, playerId)
  redis.call('ZADD', totalVolLbKey, volScore, playerId)
  
  updatedCount = updatedCount + 1
end

return updatedCount
