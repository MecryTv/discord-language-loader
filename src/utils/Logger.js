const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
};

class Logger {
  static error(message) {
    console.error(`${COLORS.red}${message}${COLORS.reset}`);
  }

  static info(message) {
    console.log(`${COLORS.green}${message}${COLORS.reset}`);
  }

  static update(message) {
    console.log(`${COLORS.blue}${message}${COLORS.reset}`);
  }
}

module.exports = { Logger };