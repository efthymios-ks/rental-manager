# Google Cloud Project Setup

- Go to https://console.cloud.google.com/ and create a new project
- Enable **Google Sheets API** at https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=YOUR_PROJECT_ID
- Go to **APIs & Services** → **OAuth consent screen**, choose **External**, fill in app name and emails, save
- Go to **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth client ID**
- Choose **Web application**, add authorized JavaScript origins (e.g. `http://127.0.0.1:5500`, `https://YOUR_USERNAME.github.io`)
- Copy the **Client ID** (not the secret) and paste it into `config.js` as `GOOGLE_CLIENT_ID`
- Go to **APIs & Services** → **Audience**, add test users or publish the app to make it production-ready
- Add your spreadsheet ID to `config.js` as `SPREADSHEET_ID` (found in the Google Sheets URL between `/d/` and `/edit`)
