const MAX_FILE_COUNT = 5;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

const acceptedTypes = new Map([
  ["application/pdf", [".pdf"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
]);

export function validateScheduleImportFiles(files: File[]) {
  if (!files.length) {
    return "Choose at least one PDF or timetable image.";
  }
  if (files.length > MAX_FILE_COUNT) {
    return `Choose no more than ${MAX_FILE_COUNT} files.`;
  }
  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return "The selected files exceed the 30 MB total limit.";
  }
  for (const file of files) {
    const extensions = acceptedTypes.get(file.type);
    const lowerName = file.name.toLowerCase();
    if (!extensions?.some((extension) => lowerName.endsWith(extension))) {
      return `${file.name} is not a supported PDF, PNG, JPG, JPEG, or WebP file.`;
    }
    if (!file.size) return `${file.name} is empty.`;
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} exceeds the 15 MB limit.`;
    }
  }
  return null;
}

export function formatImportFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
