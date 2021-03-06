"use strict";
const axios = require("axios").default;
const Env = use("Env");
const Napoleon = use("App/Models/Napoleon");
const Event = use("Event");
const moment = require('moment')

class NapoleonBot {
  errorNum; //int
  interval; //int

  constructor(order) {
    this.errorNum = 0;
    this.interval = 60000;
    if (order === "start") this.start();
  }

  async start() {
    try {
      await this.getTodayPosition();
    } catch (error) {
      this.errorNum++;
      if (this.errorNum > 3) this.interval = 600000;
      if (this.errorNum < 6) {
        setTimeout(() => {
          this.start();
        }, this.interval);
      } else {
        Event.fire("napoleon::error", error);
      }
    }
  }

  async getStratData(strat) {
    const result = await axios.post(
      "https://crypto-user-service.napoleonx.ai/v1/platform/authentification",
      {
        username: Env.get("NAPOLEON_X_USERNAME"),
        password: Env.get("NAPOLEON_X_PASSWORD"),
      }
    );
    const token = result.data.access_token;
    const stratPosition = await axios.post(
      "https://crypto-user-service.napoleonx.ai/v1/platform/getbotdetails",
      {
        access_token: token,
        email: Env.get("NAPOLEON_X_USERNAME"),
        product_code: strat,
      }
    );
    return stratPosition;
  }

  //get and save current Napoleon Position
  async getTodayPosition() {
    try {
      const activeNapoStrategies = await this.getActiveStrategies()

      for(const NapoStrategy of activeNapoStrategies) {
        const stratPosition = await this.getStratData(NapoStrategy.strategy)

        if (this.checkDateIsAfterNow(stratPosition)) {
          this.saveData(stratPosition)
          Event.fire("napoleon::success");
        } else throw new Error("Wrong NapoelonX strategies date");
      }
    } catch (error) {
      console.log(error);
      if (error.message === "Wrong NapoelonX strategies date") throw error;
      else
        throw new Error(
          "Error at request getTodayPosition() to NapoleonX.\nCheck that your username and password are correct.\nIf they are then check you have at least one token checked in NapoleonX Platform.\n" +
            error
        );
    }
  }

  checkDateIsAfterNow(response) {
    const dateNextNapoPosition = response.data.data.next_position_date
    return moment().isBefore(dateNextNapoPosition);
  }

  async getPositions(strat) {
    const stratPosition = await this.getStratData(strat);
    const positions = stratPosition.data.data.positions2;
    return positions;
  }

  async getPerformance(strat) {
    const stratPosition = await this.getStratData(strat);
    const performance = stratPosition.data.data.graphStrategy;
    return performance;
  }

  async getCurrentPosition(strat) {
    const stratPosition = await this.getStratData(strat);
    const currentPosition = stratPosition.data.data.current_position2;
    return currentPosition;
  }

  formatPositionBtcEthUsdt(position) {
    const formatPosition = {
      BTC: position["BTC-USD"],
      ETH: position["ETH-USD"],
      USDT: 1 - position["BTC-USD"] - position["ETH-USD"],
    };
    return formatPosition;
  }

  async saveData(stratPosition) {
    const position = stratPosition.data.data.current_position2;
    const currentPosition = this.formatPositionBtcEthUsdt(position);
    const napoleon = await Napoleon.findBy(
      "strategy",
      stratPosition.data.data.productCode
    );
    napoleon.position = JSON.stringify(currentPosition);
    await napoleon.save();
  }

  async getActiveStrategies() {
    const activeStrat = await Napoleon
      .query()
      .where('active', true)
      .fetch()
    
    return activeStrat.toJSON()
  }
}

module.exports = NapoleonBot;
