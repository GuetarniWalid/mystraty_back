"use strict";
const User = use("App/Models/User");
const Napoleon = use("App/Models/Napoleon");
const TradingBot = use("App/Bots/TradingBot");

const TradingBotListener = (exports = module.exports = {});

//this function has multiple purpose
//First: cut the service for all user with a subscription date expiry
//Second: start the trading bot for all user with active strategy
//Third: start the asset recording bot for all user with active strategy
TradingBotListener.getAllUser = async () => {
  //for user with a subscription expiry
  await TradingBot.deactivateStrategy();

  //get Napoleon position
  let NapoleonPositions = await Napoleon.all();
  NapoleonPositions = NapoleonPositions.toJSON();
  //get each user who has strategy active and binance keys and map through each user to start his tradingBot
  let users = await User.query()
    .with("exchanges.strategies", (builder) => {
      builder.where("active", true);
    })
    .whereHas("exchanges", (builder) => {
      builder.where("validate", true);
    })
    .whereHas("exchanges.strategies", (builder) => {
      builder.where("active", true);
    })
    .fetch();
  users = users.toJSON();

  //need to execute synchronously
  await Promise.all(
    users.map(async (user) => {
      
      for (const exchange of user.exchanges) {
        for (const strategy of exchange.strategies) {
          //start the trading bot for each strategy by user
          const tradingBot = new TradingBot({
            userId: user.id,
            newPositions: JSON.parse(
              NapoleonPositions.find(
                (napoleon) => napoleon.strategy === strategy.strategy
              ).position
            ),
            strategyId: strategy.id,
            ExchangeData: exchange,
          });
          await tradingBot.startLogic();
        }
      }
    })
  );
};
