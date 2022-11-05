require('dotenv').config({ path: '../.env' });
const { Spot } = require('@binance/connector')

class Binance {
    constructor() {
        console.log(process.env)
        this.client = new Spot(process.env.BINANCE_API_KEY, process.env.BINANCE_API_SECRET, {
            baseURL: process.env.BINANCE_BASE_URL
        });

        this.init();
    }

    async init() {
        const marketData = await this.client.exchangeInfo();
        this.marketInfo = marketData.data.symbols;
    }

    async getAssetBalance(asset) {
        const account = await this.client.account()
        const assetData = account.data.balances.find(el => el.asset.includes(asset));
        return Number(assetData.free);
    }

    async getCandles(symbols, interval, limit) {
        const response = []
        for (const symbol of symbols) {
            const { data } = await this.client.klines(symbol, interval, { limit: limit });

            response.push({
                name: symbol,
                data: data.map(bar => {
                    return {
                        openTime: new Date(bar[0]),
                        closeTime: new Date(bar[6]),
                        open: Number(bar[1]),
                        high: Number(bar[2]),
                        low: Number(bar[3]),
                        close: Number(bar[4]),
                        volume: Number(bar[5]),
                        trades: bar[8]
                    }
                })
            })
        }
        return response;
    }

    async newOrder(symbol, price, quantity) {
        const asset = this.marketInfo.find(el => el.symbol === symbol);
        const assetLotSize = asset.filters.find(filter => filter.filterType === 'LOT_SIZE');
        let formattedQuantity = Number(Number(quantity).toFixed(asset.baseAssetPrecision));
        const lotSizeMod = formattedQuantity % Number(assetLotSize.stepSize);

        if (lotSizeMod !== 0) {
            formattedQuantity = (formattedQuantity - lotSizeMod).toFixed(asset.baseAssetPrecision);
        }

        try {
            const { data: order } = await this.client.newOrder(symbol, 'BUY', 'LIMIT',
                {
                    price,
                    quantity: formattedQuantity,
                    timeInForce: 'IOC'
                }
            );
            return order;
        } catch (error) {
            console.log(error.response.data.msg)
        }
    }

    async makeSLandTPorders(symbol, quantity, stopLoss, takeProfit) {
        console.log(`
        make SLTP orders
        symbol: ${symbol}
        quantity: ${quantity} 
        stopLoss: ${stopLoss}
        takeProfit: ${takeProfit}
        `);

        const asset = this.marketInfo.find(el => el.symbol === symbol);
        const assetLotSize = asset.filters.find(filter => filter.filterType === 'LOT_SIZE');
        const assetPriceFilter = asset.filters.find(filter => filter.filterType === 'PRICE_FILTER');
        let formattedQuantity = Number(Number(quantity).toFixed(asset.baseAssetPrecision));
        const lotSizeMod = formattedQuantity % Number(assetLotSize.stepSize);

        if (lotSizeMod !== 0) {
            formattedQuantity = (formattedQuantity - lotSizeMod).toFixed(asset.baseAssetPrecision);
        }

        const { data: SLTPorder } = await this.client.newOCOOrder(
            symbol,
            'SELL',
            formattedQuantity,
            takeProfit.toFixed(asset.baseAssetPrecision),
            (stopLoss + (assetPriceFilter.tickSize * 5)).toFixed(asset.baseAssetPrecision),
            {
                stopLimitPrice: stopLoss.toFixed(asset.baseAssetPrecision),
                stopLimitTimeInForce: 'GTC'
            });

        console.log('SLTP ORDER')
        console.log(SLTPorder);

        return SLTPorder;
    }
}

module.exports = Binance;