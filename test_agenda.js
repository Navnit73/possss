const { Agenda } = require('agenda');
console.log("Agenda is:", typeof Agenda);
try {
  const agenda = new Agenda({ mongo: {} });
} catch (e) {
  console.log("Error:", e.message, "\n", e.stack);
}
