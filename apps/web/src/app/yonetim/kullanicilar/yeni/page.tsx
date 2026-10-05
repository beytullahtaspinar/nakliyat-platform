import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { PageHeader } from "../../admin-bits";
import { NewCustomerForm } from "./customer-form";

export const metadata: Metadata = { title: "Müşteri ekle" };

export default async function AdminNewCustomerPage() {
  await getAdminContext();
  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/kullanicilar", label: "Kullanıcılar" }}
        title="Müşteri ekle"
        description="Telefonla destek ya da deneme için müşteri hesabı açar. Firma hesabı Firmalar sayfasından açılır."
      />
      <Card className="max-w-3xl p-6">
        <NewCustomerForm />
      </Card>
    </>
  );
}
