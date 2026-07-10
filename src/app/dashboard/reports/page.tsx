import { redirect } from "next/navigation";

export default function ReportsIndexPage() {
  // Redirect to the first report by default
  redirect("/dashboard/reports/sales");
}
