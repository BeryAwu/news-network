import { redirect } from "next/navigation";

/** Old address of the review list. Everything now lives in Daftar berita. */
export default function EditorialPage() {
  redirect("/blasts");
}
