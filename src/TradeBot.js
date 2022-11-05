const schedule = require('node-schedule');
const Binance = require('./Binance');
const Logger = require('./Logger');

class TradeBot {
    constructor() {
        this.logger = Logger;
        this.binance = new Binance();
        this.orders = [];
    }

    async init() {
        const account = await this.binance.client.account();
        console.log(account.data.balances)

        schedule.scheduleJob('logBalances', "*/10 * * * *", async () => { // Every 10 mins
            const account = await this.binance.client.account();
            console.log(account.data.balances)
        });

        console.log('Market open. Starting trade loop');
        schedule.scheduleJob('loop', "4 */5 * * * *", async () => { // Every 5 mins in the 2nd second
            await this.searchDataAndPatterns();
        });

        schedule.scheduleJob('checkOpenOrders', "*/4 * * * * *", async () => { // Every 4 seconds
            await this.checkOpenOrders();
        });
    }

    async searchDataAndPatterns() {
        console.log('Retrieve data and search patterns');
        const marketData = await this.binance.getCandles([
            'BTCUSDT',
            'ETHUSDT',
            //'DOGEUSDT',
            'LTCUSDT',
            //'TRXUSDT',
            //'XRPUSDT',
            'BNBUSDT'
        ],
            '5m',
            3);

        for (const currency of marketData) {
            try {
                console.log(currency.name);
                const bullishEngulfing = this.searchBullishEngulfingPattern(currency.data);

                if (bullishEngulfing) {
                    await this.buy(currency);
                    break;
                }
            } catch (error) {
                console.log(error.response.data.msg);
            }
        }
    }

    searchBullishEngulfingPattern(bars) {
        // check 1st bar to be negative
        if (!(bars[0].close < bars[0].open)) return false;
        console.log('1st check pass')

        // check 2nd bar to open lower than 1st bar close
        if (!(bars[1].open <= bars[0].close)) return false;
        console.log('2nd check pass')

        // check 2nd bar close to be higher than 1st bar open
        if (!(bars[1].close > bars[0].open)) return false;
        console.log('3rd check pass')

        // check 2nd bar volume to be higher than 1st bar volume
        if (!(bars[1].volume > bars[0].volume)) return false;
        console.log('4th check pass')

        // check 2nd bar shadow to be smaller than 15% of bar body
        if (!((bars[1].high - bars[1].close) < ((bars[1].close - bars[1].open) * .15))) return false;
        console.log('5th check pass')

        return true;
    }

    async buy(currencyData) {
        try {
            const price = currencyData.data[2].close;
            const stopLoss = currencyData.data[0].low < currencyData.data[1].low
                ? currencyData.data[0].low
                : currencyData.data[1].low;
            const takeProffit = ((price - stopLoss) * 2) + price;
            const balance = await this.binance.getAssetBalance('USDT');
            const quantity = (0.2 * balance) / price;

            console.log(`
            CURRENCY: ${currencyData.name}
            PRICE: ${price}
            STOP LOSS: ${stopLoss}
            TAKE PROFIT: ${takeProffit}
            BALANCE: ${balance}
            QUANTITY: ${quantity}
            `);

            const order = await this.binance.newOrder(currencyData.name, price, quantity, stopLoss, takeProffit);
            this.orders.push({ ...order, stopLoss, takeProffit });
        } catch (error) {
            console.log(error.response.data.msg);
        }
    }

    async checkOpenOrders() {
        for (let i = 0; i < this.orders.length; i++) {
            const order = this.orders[i];

            const { data: binanceOrder } = await this.binance.client.getOrder(order.symbol, {
                orderId: order.orderId
            });

            if ((binanceOrder.status === 'FILLED' || binanceOrder.status === 'EXPIRED')) { // Make SLTP
                try {
                    if (binanceOrder.executedQty > 0) {
                        this.logger.write(new Date(), binanceOrder.symbol, 'bullishEngulfing', binanceOrder.executedQty, binanceOrder.price, order.stopLoss, order.takeProffit);
                        console.log(`
                        BUY ORDER FILLED
                        symbol: ${order.symbol}
                        orderId: ${order.orderId}
                        qty: ${binanceOrder.executedQty}
                        `)

                        const SLTPorder = await this.binance.makeSLandTPorders(
                            binanceOrder.symbol,
                            binanceOrder.executedQty,
                            order.stopLoss,
                            order.takeProffit
                        );
                    }

                    this.orders.splice(i, 1);
                } catch (error) {
                    console.log(error);
                }
            }
        }
    }
}

module.exports = TradeBot;