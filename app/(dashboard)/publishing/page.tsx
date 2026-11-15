import { redirect } from "next/navigation";

/** Old address of the publishing list. Everything now lives in Daftar berita. */
export default function PublishingPage() {
  redirect("/blasts");
}
