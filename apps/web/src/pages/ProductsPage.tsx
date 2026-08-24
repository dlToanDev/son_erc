import { useState } from 'react';
import ProductsPanel from '../components/ProductsPanel';
import { useSuppliers } from '../hooks/queries';

/** Trang Mặt hàng: chọn NCC → xem/sửa danh mục + giá của NCC đó. */
export default function ProductsPage() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const [supplierId, setSupplierId] = useState('ALL');

  const active = suppliers.filter((s) => s.status === 'ACTIVE');

  return (
    <section className="page">
      <header className="page-header">
        <h2>Mặt hàng</h2>
        <div className="page-actions">
          <select
            className="search-input"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="ALL">Tất cả nhà cung cấp ({active.length})</option>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {isLoading && <p>Đang tải…</p>}
      {!isLoading && <ProductsPanel supplierId={supplierId} />}
    </section>
  );
}
