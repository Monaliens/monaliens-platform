--[[
  Tournament Update Lua Script
  
  Atomically updates player stats and leaderboards.
  Eliminates race conditions by performing all operations in a single atomic transaction.
  
  KEYS:
    1. playerKey - Player stats hash key (tournament:player:xxx)
    2. totalPnlLbKey - Total PnL leaderboard sorted set
    3. totalVolLbKey - Total Volume leaderboard sorted set
    4. gamePnlLbKey - Game-specific PnL leaderboard sorted set
    5. gameVolLbKey - Game-specific Volume leaderboard sorted set
  
  ARGV:
    1. playerId - Player identifier (wallet or discord:xxx)
    2. pnlDelta - PnL change in wei (string, can be negative)
    3. volumeDelta - Volume change in wei (string)
    4. weightedVolumeDelta - Weighted volume change in wei (string)
    5. gamesCount - Number of games (for batch updates, otherwise 1)
    6. winsCount - Number of wins (for batch updates, otherwise won flag)
    7. game - Game name (flip, dice, etc.)
    8. discordId - Discord ID or empty string
    9. walletAddress - Wallet address to add to wallets array
    10. isHolder - 1 if holder, 0 if not
    11. multiplier - Current multiplier (e.g., "1.25")
    12. activeCollection - Collection name or empty string
    13. collectionImage - Collection image URL or empty string
    
  Returns:
    Array with [newTotalPnl, newTotalVolume, newWeightedVolume, newTotalGames]
]]

local playerKey = KEYS[1]
local totalPnlLbKey = KEYS[2]
local totalVolLbKey = KEYS[3]
local gamePnlLbKey = KEYS[4]
local gameVolLbKey = KEYS[5]

local playerId = ARGV[1]
local pnlDelta = ARGV[2]
local volumeDelta = ARGV[3]
local weightedVolumeDelta = ARGV[4]
local gamesCount = tonumber(ARGV[5]) or 1
local winsCount = tonumber(ARGV[6]) or 0
local game = ARGV[7]
local discordId = ARGV[8]
local walletAddress = ARGV[9]
local isHolder = ARGV[10]
local multiplier = ARGV[11]
local activeCollection = ARGV[12]
local collectionImage = ARGV[13]

-- Helper to safely get hash field as string (returns "0" if nil)
local function hgetOrZero(key, field)
  local val = redis.call('HGET', key, field)
  if val == false or val == nil then
    return "0"
  end
  return val
end

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

-- Helper to add large signed integer strings without losing wei precision.
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

-- Check if player exists
local exists = redis.call('EXISTS', playerKey)

-- Initialize or update player stats
if exists == 0 then
  -- Create new player entry
  redis.call('HSET', playerKey, 
    'playerId', playerId,
    'totalPnl', pnlDelta,
    'totalVolume', volumeDelta,
    'weightedVolume', weightedVolumeDelta,
    'totalGames', gamesCount,
    'wins', winsCount,
    'isHolder', isHolder,
    'multiplier', multiplier,
    'activeCollection', activeCollection,
    'collectionImage', collectionImage
  )
  
  if discordId ~= '' then
    redis.call('HSET', playerKey, 'discordId', discordId)
  end
  
  -- Initialize wallets as JSON array
  if walletAddress ~= '' then
    redis.call('HSET', playerKey, 'wallets', cjson.encode({walletAddress}))
  else
    redis.call('HSET', playerKey, 'wallets', '[]')
  end
  
  -- Initialize game-specific stats as JSON
  local gameStats = {}
  gameStats[game] = {
    pnl = pnlDelta,
    volume = volumeDelta,
    weightedVolume = weightedVolumeDelta,
    games = gamesCount,
    wins = winsCount
  }
  redis.call('HSET', playerKey, 'games', cjson.encode(gameStats))
  
else
  -- Update existing player
  local currentPnl = hgetOrZero(playerKey, 'totalPnl')
  local currentVolume = hgetOrZero(playerKey, 'totalVolume')
  local currentWeightedVolume = hgetOrZero(playerKey, 'weightedVolume')
  local currentGames = tonumber(hgetOrZero(playerKey, 'totalGames')) or 0
  local currentWins = tonumber(hgetOrZero(playerKey, 'wins')) or 0
  
  -- Update totals
  local newPnl = addBigInt(currentPnl, pnlDelta)
  local newVolume = addBigInt(currentVolume, volumeDelta)
  local newWeightedVolume = addBigInt(currentWeightedVolume, weightedVolumeDelta)
  
  redis.call('HSET', playerKey,
    'totalPnl', newPnl,
    'totalVolume', newVolume,
    'weightedVolume', newWeightedVolume,
    'totalGames', currentGames + gamesCount,
    'wins', currentWins + winsCount,
    'isHolder', isHolder,
    'multiplier', multiplier,
    'activeCollection', activeCollection,
    'collectionImage', collectionImage
  )
  
  -- Update wallets array if new wallet
  if walletAddress ~= '' then
    local walletsJson = redis.call('HGET', playerKey, 'wallets') or '[]'
    local wallets = cjson.decode(walletsJson)
    
    -- Check if wallet already exists
    local walletExists = false
    for _, w in ipairs(wallets) do
      if string.lower(w) == string.lower(walletAddress) then
        walletExists = true
        break
      end
    end
    
    if not walletExists then
      table.insert(wallets, walletAddress)
      redis.call('HSET', playerKey, 'wallets', cjson.encode(wallets))
    end
  end
  
  -- Update game-specific stats
  local gamesJson = redis.call('HGET', playerKey, 'games') or '{}'
  local gameStats = cjson.decode(gamesJson)
  
  if gameStats[game] == nil then
    gameStats[game] = {
      pnl = pnlDelta,
      volume = volumeDelta,
      weightedVolume = weightedVolumeDelta,
      games = gamesCount,
      wins = winsCount
    }
  else
    local gs = gameStats[game]
    gs.pnl = addBigInt(gs.pnl or "0", pnlDelta)
    gs.volume = addBigInt(gs.volume or "0", volumeDelta)
    gs.weightedVolume = addBigInt(gs.weightedVolume or "0", weightedVolumeDelta)
    gs.games = (gs.games or 0) + gamesCount
    gs.wins = (gs.wins or 0) + winsCount
    gameStats[game] = gs
  end
  
  redis.call('HSET', playerKey, 'games', cjson.encode(gameStats))
end

-- Get final totals for leaderboard updates
local finalPnl = hgetOrZero(playerKey, 'totalPnl')
local finalWeightedVolume = hgetOrZero(playerKey, 'weightedVolume')

-- Get game-specific totals for game leaderboards
local gamesJson = redis.call('HGET', playerKey, 'games') or '{}'
local gameStats = cjson.decode(gamesJson)
local gamePnl = "0"
local gameWeightedVolume = "0"

if gameStats[game] then
  gamePnl = gameStats[game].pnl or "0"
  gameWeightedVolume = gameStats[game].weightedVolume or "0"
end

-- Calculate scores for leaderboards (divide by 1e18 for display)
-- Note: Lua numbers have limited precision, but this is fine for leaderboard sorting
local pnlScore = tonumber(finalPnl) / 1e18
local volScore = tonumber(finalWeightedVolume) / 1e18
local gamePnlScore = tonumber(gamePnl) / 1e18
local gameVolScore = tonumber(gameWeightedVolume) / 1e18

-- Update leaderboards atomically
redis.call('ZADD', totalPnlLbKey, pnlScore, playerId)
redis.call('ZADD', totalVolLbKey, volScore, playerId)
redis.call('ZADD', gamePnlLbKey, gamePnlScore, playerId)
redis.call('ZADD', gameVolLbKey, gameVolScore, playerId)

-- Return final stats for logging
local finalGames = hgetOrZero(playerKey, 'totalGames')

return {finalPnl, finalWeightedVolume, finalGames, gamePnl, gameWeightedVolume}
