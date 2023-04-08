require('dotenv').config({ path: '../.env' })

const getLoopInterval = () => {
    const timeInterval = process.env.TRADE_INTERVAL;
    switch (process.env.TRADE_INTERVAL_UNIT) {
        case 'h':
            return `4 0 ${parseInt(timeInterval) === 1 ? '*' : `*/${timeInterval}`} * * *`;
        case 'm':
            return `4 ${parseInt(timeInterval) === 1 ? '*' : `*/${timeInterval}`} * * * *`;
        default:
            return '';
    }
}

const getOpenOrdersInterval = () => {
    const timeInterval = process.env.TRADE_INTERVAL;
    switch (process.env.TRADE_INTERVAL_UNIT) {
        case 'h':
            return `10 0 ${parseInt(timeInterval) === 1 ? '*' : `*/${timeInterval}`} * * *`;
        case 'm':
            return `10 ${parseInt(timeInterval) === 1 ? '*' : `*/${timeInterval}`} * * * *`;
        default:
            return '';
    }
}

module.exports = {
    getLoopInterval,
    getOpenOrdersInterval
}