const { Telegraf } = require("telegraf");
const AWS = require("aws-sdk");
const axios = require("axios");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WASABI_ACCESS_KEY = process.env.WASABI_ACCESS_KEY;
const WASABI_SECRET_KEY = process.env.WASABI_SECRET_KEY;
const WASABI_BUCKET_NAME = process.env.WASABI_BUCKET_NAME;
const WASABI_REGION = process.env.WASABI_REGION;
const WASABI_ENDPOINT = `https://s3.${WASABI_REGION}.wasabisys.com`;

const bot = new Telegraf(BOT_TOKEN);

// Configure AWS SDK for Wasabi
const s3 = new AWS.S3({
    endpoint: WASABI_ENDPOINT,
    accessKeyId: WASABI_ACCESS_KEY,
    secretAccessKey: WASABI_SECRET_KEY,
    region: WASABI_REGION,
    signatureVersion: "v4",
});

// ✅ Function to List All Files
async function listFiles() {
    try {
        const params = { Bucket: WASABI_BUCKET_NAME };
        const data = await s3.listObjectsV2(params).promise();

        if (!data.Contents || data.Contents.length === 0) {
            return []; // Return an empty array if no files found
        }

        return data.Contents.map((file) => file.Key);
    } catch (error) {
        console.error("Error listing files:", error);
        return null; // Return null if an error occurs
    }
}

// ✅ Handle `/files` Command
bot.command("files", async (ctx) => {
    try {
        const files = await listFiles();

        if (files === null) {
            return ctx.reply("❌ Error fetching file list. Check your Wasabi permissions.");
        }

        if (files.length === 0) {
            return ctx.reply("📂 No files found in storage.");
        }

        // 🔹 Send list of files as inline keyboard buttons
        const buttons = files.map((file) => [{ text: file, callback_data: `browse_${file}` }]);

        await ctx.reply("📂 Select a file to generate a new link:", {
            reply_markup: { inline_keyboard: buttons },
        });
    } catch (error) {
        console.error("Error handling /files command:", error);
        await ctx.reply("❌ An error occurred while retrieving files.");
    }
});

// ✅ Handle File Selection
bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith("browse_")) {
        const fileName = data.replace("browse_", "");

        await ctx.reply("Choose the validity period:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⏳ 24 Hours", callback_data: `link_24_${fileName}` }],
                    [{ text: "♾️ Always Available", callback_data: `link_perm_${fileName}` }],
                ],
            },
        });
    } else if (data.startsWith("link_")) {
        const [_, duration, fileName] = data.split("_");

        let fileUrl;
        if (duration === "24") {
            fileUrl = await getTemporaryUrl(fileName);
        } else if (duration === "perm") {
            fileUrl = getPermanentUrl(fileName);
        }

        await ctx.reply(`✅ Here is your file link: ${fileUrl}`);
    }
});

// ✅ Generate Temporary 24-Hour Link
async function getTemporaryUrl(fileName) {
    return s3.getSignedUrlPromise("getObject", {
        Bucket: WASABI_BUCKET_NAME,
        Key: fileName,
        Expires: 86400, // 24 hours
    });
}

// ✅ Generate Permanent Public URL
function getPermanentUrl(fileName) {
    return `${WASABI_ENDPOINT}/${WASABI_BUCKET_NAME}/${fileName}`;
}

// Start the bot
bot.launch();
          
