const Indicators = require('./Indicators');

class Strategies {
    static bullishEngulfing(bars) {
        const lastBarIndex = bars.length - 1;
        // check 1st bar to be negative
        if (!(bars[lastBarIndex - 2].close < bars[lastBarIndex - 2].open)) return false;
        console.log('1st check pass')

        // check 2nd bar to open lower than 1st bar close
        if (!(bars[lastBarIndex - 1].open <= bars[lastBarIndex - 2].close)) return false;
        console.log('2nd check pass')

        // check 2nd bar close to be higher than 1st bar open
        if (!(bars[lastBarIndex - 1].close > bars[lastBarIndex - 2].open)) return false;
        console.log('3rd check pass')

        // check 2nd bar volume to be higher than 1st bar volume
        if (!(bars[lastBarIndex - 1].volume > bars[lastBarIndex - 2].volume)) return false;
        console.log('4th check pass')

        // check 2nd bar shadow to be smaller than 15% of bar body
        if (!((bars[lastBarIndex - 1].high - bars[lastBarIndex - 1].close) < ((bars[lastBarIndex - 1].close - bars[lastBarIndex - 1].open) * .15))) return false;
        console.log('5th check pass')

        const price = bars[lastBarIndex].close;
        const stopLoss = bars[lastBarIndex - 2].low < bars[lastBarIndex - 1].low
            ? bars[lastBarIndex - 2].low
            : bars[lastBarIndex - 1].low;
        const takeProffit = ((price - stopLoss) * 2) + price;

        return {
            price,
            stopLoss,
            takeProffit
        };
    }

    static smaCross(shortSmaRounds, longSmaRounds, bars, operation = 'BUY') {
        const previousShortSma = Indicators.SMA(bars, shortSmaRounds, true);
        const previousLongSma = Indicators.SMA(bars, longSmaRounds, true);
        const lastShortSma = Indicators.SMA(bars, shortSmaRounds);
        const lastLongSma = Indicators.SMA(bars, longSmaRounds);

        if (operation === 'BUY' && (previousShortSma - previousLongSma <= 0) && (lastShortSma - lastLongSma > 0)) {
            return { price: bars[bars.length - 1].close };
        }

        if (operation === 'SELL' && (lastShortSma - lastLongSma < 0)) {
            return { price: bars[bars.length - 1].close };
        }
    }
}

module.exports = Strategies;