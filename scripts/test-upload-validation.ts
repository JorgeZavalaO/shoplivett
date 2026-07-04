import assert from "node:assert/strict";

import {
  BLOB_MAX_BYTES,
  BLOB_MAX_FILES_PER_ACTION,
  BLOB_MAX_TOTAL_BYTES,
  ImageUploadError,
  uploadImage,
  validateImageBatch,
} from "../lib/blob";

function makePngFile(size: number, name = "test.png"): File {
  const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const body = new Uint8Array(Math.max(0, size - header.length));
  const data = new Uint8Array(size);
  data.set(header, 0);
  data.set(body, header.length);
  return new File([data], name, { type: "image/png" });
}

function makeFakePng(name = "fake.png"): File {
  return new File([new Uint8Array([0x4d, 0x5a, 0x00, 0x00])], name, { type: "image/png" });
}

async function run() {
  validateImageBatch(Array.from({ length: BLOB_MAX_FILES_PER_ACTION }, () => makePngFile(32)));

  assert.throws(
    () => validateImageBatch(Array.from({ length: BLOB_MAX_FILES_PER_ACTION + 1 }, () => makePngFile(32))),
    (err) => err instanceof ImageUploadError && err.code === "TOO_MANY_FILES",
  );

  const oversizedBatch = [makePngFile(BLOB_MAX_TOTAL_BYTES - 16), makePngFile(32)];
  assert.throws(
    () => validateImageBatch(oversizedBatch),
    (err) => err instanceof ImageUploadError && err.code === "TOTAL_TOO_LARGE",
  );

  process.env.BLOB_READ_WRITE_TOKEN = "test-token";

  await assert.rejects(
    uploadImage(makeFakePng(), "payments/receipts", "bad"),
    (err) => err instanceof ImageUploadError && err.code === "INVALID_SIGNATURE",
  );

  await assert.rejects(
    uploadImage(makePngFile(BLOB_MAX_BYTES + 1), "payments/receipts", "big"),
    (err) => err instanceof ImageUploadError && err.code === "TOO_LARGE",
  );

  console.log("upload validation ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
