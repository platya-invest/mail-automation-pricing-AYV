require('dotenv').config();
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  // Build credentials from environment variables
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  
  console.log('🔥 Firebase initialized with credentials from environment variables');
}

const db = getFirestore();
db.settings({
  databaseId: process.env.DATABASE_ID,
});

async function saveToFirebase(fondosData) {
  try {
    const priceUnitsRef = db.collection("priceUnits");
    const fundsRef = db.collection("funds");
    console.log("🔥 Saving data to Firebase...");

    if (!Array.isArray(fondosData) || fondosData.length === 0) {
      console.log("⚠️  No fund data to save");
      return;
    }

    let savedCount = 0;
    let errorCount = 0;

    // Process each fund
    for (const fondo of fondosData) {
      try {
        const { idFund, date, price } = fondo;
        
        if (!idFund || !date || price === undefined) {
          console.log(`⚠️  Incomplete data for fund:`, fondo);
          errorCount++;
          continue;
        }

        // 1. Save to priceUnits historical (as before)
        const historicalRef = priceUnitsRef
          .doc(idFund)
          .collection("historical")
          .doc(date);

        const historicalData = {
          date: date,
          price: price
        };

        await historicalRef.set(historicalData, { merge: true });
        console.log(`✅ Historical saved: priceUnits/${idFund}/historical/${date} - Price: ${price}`);

        // 2. Update "unit" field in funds collection
        const fundRef = fundsRef.doc(idFund);
        
        await fundRef.update({
          unit: price
        });
        
        console.log(`✅ Fund updated: funds/${idFund} - unit: ${price}`);
        savedCount++;

      } catch (error) {
        console.error(`❌ Error saving fund ${fondo.idFund}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Save summary:`);
    console.log(`   ✅ Funds saved successfully: ${savedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📈 Total processed: ${fondosData.length}`);
    
    if (savedCount > 0) {
      console.log("🔥 Data saved successfully to Firebase");
    }

    return {
      success: savedCount > 0,
      savedCount,
      errorCount,
      totalProcessed: fondosData.length
    };

  } catch (error) {
    console.error("❌ General error saving to Firebase:", error);
    throw error;
  }
}

module.exports = { saveToFirebase }; 