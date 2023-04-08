const Logger = require("./Logger");

class Indicators {
    static supertrends = [];

    static SMA(bars, period, previous = false) {
        const negativeOffset = previous ? -2 : -1;
        const effectiveBars = bars.slice(-period + negativeOffset, negativeOffset);
        return effectiveBars.reduce((acc, bar) => acc + bar.close, 0) / period;
    }

    static Supertrend(currency, bars, period = 10, multiplier = 3) {
        const lastBar = bars[bars.length - 2];
        const ATR = this.ATR(bars, period);

        const barAvg = (lastBar.high + lastBar.low) / 2;
        const upperBasic = Math.round((barAvg + multiplier * ATR) * 1e2) / 1e2;
        const lowerBasic = Math.round((barAvg - multiplier * ATR) * 1e2) / 1e2;

        const previousSTindex = this.supertrends.findIndex(ST => ST.currency === currency);

        if (previousSTindex) {
            this.supertrends[previousSTindex] = {
                currency,
                upperBasic: 0,
                lowerBasic: 0,
                upper: 0,
                lower: 0,
                supertrend: 0,
                bought: false
            }
        }

        const previousST = this.supertrends[previousSTindex];
        const upper = ((upperBasic < previousST.upper) || (bars[bars.length - 3].close > previousST.upper)) ? upperBasic : previousST.upper;
        const lower = ((lowerBasic > previousST.lower) || (bars[bars.length - 3].close < previousST.lower)) ? lowerBasic : previousST.lower;
        let supertrend = lower;

        if (previousST.supertrend === previousST.upper && lastBar.close < upper) {
            supertrend = upper;
        } else if (previousST.supertrend === previousST.upper && lastBar.close > upper) {
            supertrend = lower;
        } else if (previousST.supertrend === previousST.lower && lastBar.close > lower) {
            supertrend = lower;
        } else if (previousST.supertrend === previousST.lower && lastBar.close < lower) {
            supertrend = upper;
        } else {
            supertrend = 0;
        }

        this.supertrends[previousSTindex] = {
            currency,
            upperBasic,
            lowerBasic,
            upper,
            lower,
            supertrend,
            bought: this.supertrends[previousSTindex].bought
        }

        if (lastBar.close > supertrend && !previousST.bought) {
            console.log('SUPERTREND BUY', lastBar.close);
            this.supertrends[previousSTindex].bought = true;
            Logger.write(new Date(), currency, 'SUPERTREND-BUY', null, lastBar.close, null, null);
        }

        if (lastBar.close < supertrend && previousST.bought) {
            console.log('SUPERTREND SELL', lastBar.close)
            this.supertrends[previousSTindex].bought = false;
            Logger.write(new Date(), currency, 'SUPERTREND-SELL', null, lastBar.close, null, null);

        }

        console.log(this.supertrends[previousSTindex])
        return supertrend;
    }

    static ATR(bars, period = 14) {
        const firstATRbars = bars.slice(0, period);
        let prevATR = firstATRbars.reduce((acc, bar, i) => acc + this.TR(bar, firstATRbars[i - 1]), 0) / period;
        let currentTR;
        let currentATR;
        for (let i = period; i < bars.length - 1; i++) {
            currentTR = this.TR(bars[i], bars[i - 1]);
            currentATR = ((prevATR * (period - 1)) + currentTR) / period;
            prevATR = currentATR;
        }

        return currentATR;
    }

    static TR(lastBar, prevBar = null) {
        if (!prevBar) return lastBar.high - lastBar.low;

        return Math.max(
            lastBar.high - lastBar.low,
            Math.abs(lastBar.high - prevBar.close),
            Math.abs(prevBar.close - lastBar.low)
        );
    }
}

module.exports = Indicators;