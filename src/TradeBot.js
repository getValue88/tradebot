require('dotenv').config({ path: '../.env' })
const schedule = require('node-schedule');
const { getLoopInterval, getOpenOrdersInterval } = require('./cronIntervals');
const Binance = require('./Binance');
const Strategies = require('./Strategies');
const Logger = require('./Logger');
const Indicators = require('./Indicators');

class TradeBot {
    constructor() {
        this.logger = Logger;
        this.binance = new Binance();
        this.orders = [];
        this.tradeAccountPercentage = parseFloat(process.env.TRADE_ACCOUNT_PERCENTAGE);
    }

    async init() {
        const account = await this.binance.client.account();
        console.log(account.data.balances)

        schedule.scheduleJob('logBalances', "10 * * * *", async () => { // Every hour at 10 min
            const account = await this.binance.client.account();
            console.log(account.data.balances);
            console.log(this.orders);
        });

        console.log('Market open. Starting trade loop');
        schedule.scheduleJob('loop', getLoopInterval(), async () => {
            await this.searchDataAndPatterns();
        });

        schedule.scheduleJob('checkOpenOrders', getOpenOrdersInterval(), async () => {
            await this.checkOpenOrdersAndMakeSLTP();
        });
    }

    async searchDataAndPatterns() {
        console.log('Retrieve data and search patterns', new Date());
        const marketData = await this.binance.getCandles([
            'BTCUSDT',
            'ETHUSDT',
            //'DOGEUSDT',
            'LTCUSDT',
            //'TRXUSDT',
            //'XRPUSDT',
            'BNBUSDT'
        ]);

        for (const currency of marketData) {
            try {
                console.log(currency.name);
                if (currency.data.length != process.env.CANDLESTICK_QTY) break;
                // await this.checkSellSmaCross(currency);
                // await this.executeBullishEngulfingStrategy(currency);
                // await this.executeSmaCrossStrategy(currency);
                console.log('ST', Indicators.Supertrend(currency.name, currency.data,10,2));
            } catch (error) {
                console.log(error);
            }
        }
    }

    async checkOpenOrdersAndMakeSLTP() {
        for (let i = 0; i < this.orders.length; i++) {
            const order = this.orders[i];

            const { data: binanceOrder } = await this.binance.client.getOrder(order.symbol, {
                orderId: order.orderId
            });

            if ((order.strategy === 'bullishEngulfing' && (binanceOrder.status === 'FILLED' || binanceOrder.status === 'EXPIRED'))) { // Make SLTP
                try {
                    if (binanceOrder.executedQty > 0) {
                        this.logger.write(new Date(), binanceOrder.symbol, 'bullishEngulfing', binanceOrder.executedQty, binanceOrder.price, order.stopLoss, order.takeProffit);
                        console.log(`
                        BUY ORDER FILLED
                        symbol: ${order.symbol}
                        ${new Date()}
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

    async checkSellSmaCross(currency) {
        try {
            const smaCrossOpenOrderIndex = this.orders.findIndex(o => o.strategy === 'smaCross' && o.symbol === currency.name);
            if (smaCrossOpenOrderIndex === -1) return;

            const smaCross = Strategies.smaCross(process.env.SHORT_SMA_ROUNDS, process.env.LONG_SMA_ROUNDS, currency.data, 'SELL');

            if (smaCross) {
                const order = this.orders[smaCrossOpenOrderIndex];
                const { data: binanceOrder } = await this.binance.client.getOrder(order.symbol, {
                    orderId: order.orderId
                });

                console.log(`
                CURRENCY: ${binanceOrder.symbol}
                ${new Date()}
                STRATEGY: SMA CROSS SELL
                PRICE: ${currency.data[currency.data.length - 1].close}
                QUANTITY: ${binanceOrder.executedQty}
                `);

                await this.binance.newOrder(
                    binanceOrder.symbol,
                    'SELL',
                    'MARKET',
                    null,
                    binanceOrder.executedQty,
                    null
                );

                this.orders.splice(smaCrossOpenOrderIndex, 1);
            }
        } catch (error) {
            console.log(error);
        }

    }

    async executeBullishEngulfingStrategy(currency) {
        try {
            const bullishEngulfing = Strategies.bullishEngulfing(currency.data);

            if (bullishEngulfing) {
                const { price, stopLoss, takeProffit } = bullishEngulfing;
                const balance = await this.binance.getAssetBalance('USDT');
                const quantity = (this.tradeAccountPercentage * balance) / price;

                console.log(`
                CURRENCY: ${currency.name}
                ${new Date()}
                STRATEGY: BULLISHENGULFING
                PRICE: ${price}
                STOP LOSS: ${stopLoss}
                TAKE PROFIT: ${takeProffit}
                BALANCE: ${balance}
                QUANTITY: ${quantity}
                `);

                const order = await this.binance.newOrder(
                    currency.name,
                    'BUY',
                    'LIMIT',
                    price,
                    quantity,
                    'IOC'
                );

                this.orders.push({ ...order, stopLoss, takeProffit, strategy: 'bullishEngulfing' });
            }
        } catch (error) {
            console.log(error);
        }

    }

    async executeSmaCrossStrategy(currency) {
        try {
            const crossSMA = Strategies.smaCross(parseInt(process.env.SHORT_SMA_ROUNDS), parseInt(process.env.LONG_SMA_ROUNDS), currency.data);

            if (crossSMA) {
                const { price } = crossSMA;
                const balance = await this.binance.getAssetBalance('USDT');
                const quantity = (this.tradeAccountPercentage * balance) / price;

                console.log(`
                CURRENCY: ${currency.name}
                ${new Date()}
                STRATEGY: SMA CROSS BUY
                PRICE: ${price}
                BALANCE: ${balance}
                QUANTITY: ${quantity}
                `);

                const order = await this.binance.newOrder(
                    currency.name,
                    'BUY',
                    'MARKET',
                    null,
                    quantity,
                    null
                );

                this.orders.push({ ...order, strategy: 'smaCross' });
                this.logger.write(new Date(), currency.name, 'SMA-CROSS', quantity, price, null, null);
            }
        } catch (error) {
            console.log(error);
        }
    }
}

module.exports = TradeBot;