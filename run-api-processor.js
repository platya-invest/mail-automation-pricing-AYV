const ApiProcessor = require("./api-processor");

async function runApiProcessor() {
  try {
    console.log("🚀 Starting Fund Profitability REST API processing...");

    const processor = new ApiProcessor();

    const result = await processor.processDaily();

    const { saveToFirebase } = require("./save-firebase");

    let firebaseResult = { success: false };

    if (result.allFondosData && result.allFondosData.length > 0) {
      console.log(`\n📊 Saving ${result.allFondosData.length} fund records to Firebase...`);

      console.log(result.allFondosData);
      // Llama a la función existente de Firebase
      firebaseResult = await saveToFirebase(result.allFondosData);
    } else {
      console.log("⚠️ No fund data found to save to Firebase");
    }

    console.log("\n Processing result:");
    console.log("─────────────────────────────────");
    console.log(`✅ Successful: ${result.success}`);
    console.log(`📁 Funds processed: ${result.fondosProcessed || 0}`);

    if (firebaseResult) {
      console.log(`🔥 Firebase saved: ${firebaseResult.success}`);
    }

    return result;
  } catch (error) {
    console.error("❌ Error in processing:", error.message);
    console.error("Stack trace:", error.stack);

    throw error;
  }
}

if (require.main === module) {
  runApiProcessor()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runApiProcessor };
