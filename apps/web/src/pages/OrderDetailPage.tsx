import { useParams, useNavigate } from 'react-router-dom';
import OrderDetailModal from '../components/OrderDetailModal';

/** Route /orders/:id — mở link trực tiếp: hiển thị cửa sổ chi tiết, đóng → về danh sách. */
export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  return (
    <section className="page">
      <OrderDetailModal orderId={id} open onClose={() => navigate('/orders')} />
    </section>
  );
}
