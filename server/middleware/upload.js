import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import s3 from "../config/s3.js";

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,

    metadata: (req, file, cb) => {
      cb(null, {
        fieldName: file.fieldname,
      });
    },

    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);

      const fileName = `prescriptions/${Date.now()}-${uuidv4()}${ext}`;

      cb(null, fileName);
    },
  }),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }

    cb(null, true);
  },
});

export default upload;