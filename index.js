const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;
const FILES_DIR = path.join(__dirname, "files");

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

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
    res.render("index", { files });
  });
});

// Route: View a single note
app.get("/files/:filename", (req, res) => {
  const filename = req.params.filename;
  fs.readFile(path.join(FILES_DIR, filename), "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(404).send("File not found");
    }
    res.render("show", {
      filename,
      title: path.basename(filename, ".txt"),
      message: data,
    });
  });
});

// Route: Render edit page
app.get("/edit/:filename", (req, res) => {
  const filename = req.params.filename;
  fs.readFile(path.join(FILES_DIR, filename), "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file for edit:", err);
      return res.status(404).send("File not found");
    }
    res.render("edit", {
      filename,
      title: path.basename(filename, ".txt"),
      message: data,
    });
  });
});

// Route: Create new note
app.post("/create", (req, res) => {
  const title = req.body.title.trim();
  const filename = `${title.split(" ").join("")}.txt`;

  fs.writeFile(path.join(FILES_DIR, filename), req.body.message, (err) => {
    if (err) {
      console.error("Error creating file:", err);
      return res.status(500).send("Internal Server Error");
    }
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
    if (err) {
      console.error("Error updating file content:", err);
      return res.status(500).send("Internal Server Error");
    }

    if (oldFilename !== newFilename) {
      fs.rename(oldPath, newPath, (err) => {
        if (err) {
          console.error("Error renaming file:", err);
          return res.status(500).send("Internal Server Error");
        }
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
    if (err) {
      console.error("Error deleting file:", err);
      return res.status(500).send("Internal Server Error");
    }
    res.redirect("/?success=deleted");
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
