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
    // if (err) {
    //   console.error("Error reading files:", err);
    //   return res.status(500).send("Internal Server Error");
    // }
    res.render("index", { files: files });
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
