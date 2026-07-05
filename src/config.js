window.CONFIG = {
  dataSource: {
    id: "%%SPREADSHEET_ID%%",
  },
  GOOGLE_CLIENT_ID: "%%GOOGLE_CLIENT_ID%%",
  ALLOWED_EMAILS: "%%ALLOWED_EMAILS%%".split(",").map((email) => email.trim()),
};
