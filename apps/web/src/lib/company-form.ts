/** Firma profili formundan API gövdesi; firma panelinde ve yönetimde aynı form kullanılır. */
export function companyProfileBody(formData: FormData, isNew: boolean) {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const k3 = text("k3LicenseNumber");
  const description = text("description");
  const cityCode = text("cityCode");
  return {
    displayName: text("displayName"),
    legalName: text("legalName"),
    taxNumber: text("taxNumber").replace(/\s/g, ""),
    cityCode,
    serviceCityCodes: [...new Set([cityCode, ...formData.getAll("serviceCityCodes").map(String)])],
    // Güncellemede boş bırakılan alan silinmez; yeni profilde hiç gönderilmez
    ...(k3 ? { k3LicenseNumber: k3 } : {}),
    ...(description || !isNew ? { description } : {}),
  };
}
