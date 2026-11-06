require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3000;
const FILES_DIR = path.join(__dirname, "files");
const TAGS_FILE = path.join(FILES_DIR, "tags.json");

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Ensure tags.json exists
if (!fs.existsSync(TAGS_FILE)) {
  fs.writeFileSync(TAGS_FILE, JSON.stringify({}));
}

// Initialize Google Gemini API (Free Tier via Google AI Studio)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ ERROR: GEMINI_API_KEY is missing in your .env file!");
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

/**
 * 💡 Helper function to automatically retry AI calls if a 503 Service Unavailable error occurs
 */
async function generateWithRetry(prompt, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result;
    } catch (error) {
      if (error.status === 503 && i < retries - 1) {
        console.warn(
          `⚠️ Gemini server busy (503). Retrying attempt ${i + 1} in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
}

// Helper to load tags
const getTagsData = () => {
  try {
    const data = fs.readFileSync(TAGS_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
};

// Helper to save tags
const saveTagsData = (tagsObj) => {
  fs.writeFileSync(TAGS_FILE, JSON.stringify(tagsObj, null, 2));
};

// Middleware
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Route: View all notes
app.get("/", (req, res) => {
  fs.readdir(FILES_DIR, (err, files) => {
    if (err) {
      console.error("Error reading files:", err);
      return res.status(500).send("Internal Server Error");
    }
    const noteFiles = files.filter((f) => f !== "tags.json");
    const tagsData = getTagsData();

    res.render("index", { files: noteFiles, tagsData });
  });
});

// Route: View a single note
app.get("/files/:filename", (req, res) => {
  const filename = req.params.filename;
  fs.readFile(path.join(FILES_DIR, filename), "utf8", (err, data) => {
    if (err) {
      return res.status(404).send("File not found");
    }
    const tagsData = getTagsData();
    res.render("show", {
      filename,
      title: path.basename(filename, ".txt"),
      message: data,
      tags: tagsData[filename] || [],
      aiAnswer: null,
      userQuestion: "",
      aiError: null,
    });
  });
});

// Route: Render edit page
app.get("/edit/:filename", (req, res) => {
  const filename = req.params.filename;
  fs.readFile(path.join(FILES_DIR, filename), "utf8", (err, data) => {
    if (err) {
      return res.status(404).send("File not found");
    }
    res.render("edit", {
      filename,
      title: path.basename(filename, ".txt"),
      message: data,
    });
  });
});

// Route: Create new note (Instantaneous, no AI lag)
app.post("/create", (req, res) => {
  const title = req.body.title.trim();
  const message = req.body.message;
  const filename = `${title.split(" ").join("")}.txt`;

  // Save note immediately without waiting for AI
  fs.writeFile(path.join(FILES_DIR, filename), message, (err) => {
    if (err) {
      console.error("Error creating file:", err);
      return res.status(500).send("Internal Server Error");
    }

    // Assign a default tag instantly
    const tagsData = getTagsData();
    tagsData[filename] = ["Note"];
    saveTagsData(tagsData);

    res.redirect("/?success=created");
  });
});

// Route: Update / Rename note
app.post("/update/:filename", (req, res) => {
  const oldFilename = req.params.filename;
  const newTitle = req.body.title.trim();
  const newFilename = `${newTitle.split(" ").join("")}.txt`;
  const oldPath = path.join(FILES_DIR, oldFilename);
  const newPath = path.join(FILES_DIR, newFilename);

  fs.writeFile(oldPath, req.body.message, (err) => {
    if (err) return res.status(500).send("Internal Server Error");

    const tagsData = getTagsData();
    if (tagsData[oldFilename]) {
      tagsData[newFilename] = tagsData[oldFilename];
      if (oldFilename !== newFilename) delete tagsData[oldFilename];
      saveTagsData(tagsData);
    }

    if (oldFilename !== newFilename) {
      fs.rename(oldPath, newPath, (err) => {
        if (err) return res.status(500).send("Internal Server Error");
        res.redirect("/?success=updated");
      });
    } else {
      res.redirect("/?success=updated");
    }
  });
});

// Route: Delete note
app.post("/delete/:filename", (req, res) => {
  const filename = req.params.filename;
  fs.unlink(path.join(FILES_DIR, filename), (err) => {
    if (err) return res.status(500).send("Internal Server Error");

    const tagsData = getTagsData();
    if (tagsData[filename]) {
      delete tagsData[filename];
      saveTagsData(tagsData);
    }

    res.redirect("/?success=deleted");
  });
});

// AI Feature 1: Grammar & Markdown Fixer (Only runs when clicking the ✨ button)
app.post("/ai-fix/:filename", async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(FILES_DIR, filename);

  fs.readFile(filePath, "utf8", async (err, data) => {
    if (err) return res.status(404).send("File not found");

    try {
      const prompt = `Rewrite and format the following messy note into clean, structured Markdown. Fix grammar, add headings, bullet points, or code blocks where appropriate. Return ONLY the formatted markdown content:\n\n${data}`;

      const result = await generateWithRetry(prompt);
      const fixedText = result.response.text();

      fs.writeFileSync(filePath, fixedText);
      res.redirect(`/files/${encodeURIComponent(filename)}`);
    } catch (error) {
      console.error("❌ AI Fix Error Details:", error);
      res
        .status(500)
        .send(
          `Failed to process grammar fix due to high server demand. Please try again in a few seconds. (${error.message})`,
        );
    }
  });
});

// AI Feature 2: Chat / Q&A over Note (Only runs when clicking the 💬 button & submitting)
app.post("/ai-chat/:filename", async (req, res) => {
  const filename = req.params.filename;
  const userQuestion = req.body.question;
  const filePath = path.join(FILES_DIR, filename);

  fs.readFile(filePath, "utf8", async (err, data) => {
    if (err) return res.status(404).send("File not found");

    const tagsData = getTagsData();

    try {
      const prompt = `You are a helpful assistant. Answer the user's question based strictly and concisely on the following note content:\n\nNote Content:\n${data}\n\nUser Question: ${userQuestion}`;

      const result = await generateWithRetry(prompt);
      const answer = result.response.text();

      res.render("show", {
        filename,
        title: path.basename(filename, ".txt"),
        message: data,
        tags: tagsData[filename] || [],
        aiAnswer: answer,
        userQuestion: userQuestion,
        aiError: null,
      });
    } catch (error) {
      console.error("❌ AI Chat Error Details:", error);

      const errorMessage =
        error.status === 503 || error.message.includes("503")
          ? "⚠️ Service is busy right now due to high demand. Please try again in a few seconds!"
          : `⚠️ Failed to get AI answer: ${error.message}`;

      res.render("show", {
        filename,
        title: path.basename(filename, ".txt"),
        message: data,
        tags: tagsData[filename] || [],
        aiAnswer: null,
        userQuestion: userQuestion,
        aiError: errorMessage,
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
