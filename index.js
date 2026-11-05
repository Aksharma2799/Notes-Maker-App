const express = require("express");
const fs = require("fs");
const app = express();
const path = require("path");
const port = 3000;

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  fs.readdir("./files", (err, files) => {
    if (err) {
      console.error("Error reading files:", err);
      return res.status(500).send("Internal Server Error");
    }
    res.render("index", { files: files });
  });
});

app.get("/files/:filename", (req, res) => {
  const filename = req.params.filename;
  fs.readFile(`./files/${filename}`, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(404).send("File not found");
    }
    // Pass filename along with title and message
    res.render("show", {
      filename: filename,
      title: filename.split(".txt")[0],
      message: data,
    });
  });
});

// Route to render the edit page
app.get("/edit/:filename", (req, res) => {
  const filename = req.params.filename;
  fs.readFile(`./files/${filename}`, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file for edit:", err);
      return res.status(404).send("File not found");
    }
    res.render("edit", {
      filename: filename,
      title: filename.split(".txt")[0],
      message: data,
    });
  });
});

// Route to handle updating/renaming the note
app.post("/update/:filename", (req, res) => {
  const oldFilename = req.params.filename;
  const newFilename = req.body.title.split(" ").join("") + ".txt";

  // First write the new content
  fs.writeFile(`./files/${oldFilename}`, req.body.message, (err) => {
    if (err) {
      console.error("Error updating file content:", err);
      return res.status(500).send("Internal Server Error");
    }

    // If the title changed, rename the file
    if (oldFilename !== newFilename) {
      fs.rename(`./files/${oldFilename}`, `./files/${newFilename}`, (err) => {
        if (err) {
          console.error("Error renaming file:", err);
          return res.status(500).send("Internal Server Error");
        }
        res.redirect("/");
      });
    } else {
      res.redirect("/");
    }
  });
});

// Route to delete the file
app.post("/delete/:filename", (req, res) => {
  const filename = req.params.filename;
  fs.unlink(`./files/${filename}`, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
      return res.status(500).send("Internal Server Error");
    }
    res.redirect("/");
  });
});

app.post("/create", (req, res) => {
  fs.writeFile(
    `./files/${req.body.title.split(" ").join("")}.txt`,
    req.body.message,
    (err) => {
      if (err) {
        console.error("Error creating file:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/");
    },
  );
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
