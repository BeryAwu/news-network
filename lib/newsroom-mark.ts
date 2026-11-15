/** The Newsroom product logo: a coral tile holding a folded newspaper page. Same drawing in the sidebar, the login screen and the browser tab. */
export const NEWSROOM_COLOR = "#f08a5d";
export const NEWSROOM_INK = "#2b1d17";

export const newsroomMarkInner = `<rect width="48" height="48" rx="12" fill="${NEWSROOM_COLOR}"/><path d="M14 11h16l6 6v20a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2z" fill="#fff8f2"/><path d="M30 11v6h6z" fill="#e3b79c"/><rect x="16" y="20" width="10" height="3" rx="1.5" fill="${NEWSROOM_INK}"/><rect x="16" y="26" width="16" height="2.5" rx="1.25" fill="${NEWSROOM_INK}" opacity=".55"/><rect x="16" y="31" width="13" height="2.5" rx="1.25" fill="${NEWSROOM_INK}" opacity=".55"/>`;

export const newsroomIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="64" height="64">${newsroomMarkInner}</svg>`;
