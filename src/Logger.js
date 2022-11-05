const fs = require('fs');

class Logger {
    static write(timestamp, symbol, pattern,quantity, price, stopLoss, takeProffit) {
        fs.appendFileSync(`../logs/${symbol}-${pattern}.txt`, `${timestamp},${quantity},${price},${stopLoss},${takeProffit}\n`);
    }
}

module.exports = Logger;