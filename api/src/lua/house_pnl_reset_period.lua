--[[
  House PnL Reset Period Lua Script

  Clears one monthly period aggregate and initializes the total hash to zero.

  KEYS:
    1. periodKey
    2..n. game aggregate keys or response cache keys to delete

  ARGV:
    1. timestampIso
]]

local periodKey = KEYS[1]
local timestampIso = ARGV[1]

for i = 1, #KEYS do
  redis.call('DEL', KEYS[i])
end

redis.call('HSET', periodKey,
  'housePnlWei', '0',
  'grossPnlWei', '0',
  'feeWei', '0',
  'wageredWei', '0',
  'payoutWei', '0',
  'games', '0',
  'updatedAt', timestampIso,
  'pnlVersion', 'cash-v2'
)

return 1
