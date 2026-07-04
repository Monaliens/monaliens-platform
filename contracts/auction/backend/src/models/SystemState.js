const mongoose = require("mongoose");

const systemStateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Static helper methods
systemStateSchema.statics.get = async function (key, defaultValue = null) {
  const doc = await this.findOne({ key });
  return doc ? doc.value : defaultValue;
};

systemStateSchema.statics.set = async function (key, value) {
  return this.findOneAndUpdate(
    { key },
    { value },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model("SystemState", systemStateSchema);
