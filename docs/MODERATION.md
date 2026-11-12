# Quản trị thư và lọc nội dung

## Xóa thư

Đăng nhập bằng tài khoản `admin` đã được tạo trên máy chủ → **Tài khoản → Quản trị thư** → mở một thư → **Xóa thư** → xác nhận. Có tiếng Việt và English. Tên `admin` vẫn bị cấm đăng ký công khai; nút giao diện không thay thế kiểm tra quyền ở API.

`POST /api/admin/letters/delete` nhận JSON `{ "id": "UUID của thư" }`, yêu cầu phiên admin và kiểm tra Origin giống các thao tác ghi khác. Máy chủ xóa nội dung, giữ ID, người xóa và thời điểm trong bảng `removed_letters`. Thao tác dùng transaction; lần xóa lại trả 404. ID đã xóa không thể nhập lại (410), kể cả sau khi khởi động lại.

Bảng được tạo tự động khi khởi động, không đổi dữ liệu thư còn lại. API lấy thư trả thêm `removedIds` để ứng dụng loại bản lưu cũ trên thiết bị khi tải tài khoản. Thiết bị đang mở trang phải tải lại để nhận thay đổi; chức năng này không thể thu hồi bản chụp màn hình hoặc bản sao đã xuất ra ngoài ứng dụng. Thư chỉ có trên thiết bị, chưa nhập lên máy chủ, không xuất hiện trong danh sách quản trị.

## Bộ lọc

Dùng chung `src/moderation.js` ở trình duyệt, API lưu thư và kiểm tra kết quả AI. Kiểm tra tiêu đề, nội dung, tên hiển thị; API còn kiểm tra nhãn địa điểm. Trả lỗi `abusive_language` (422) nếu vi phạm. Thư cũ không bị tự xóa hàng loạt; admin xem và quyết định xóa.

- Bổ sung nhóm chửi tục, xúc phạm, viết tắt, teencode và một số từ tiếng Anh.
- Chuẩn hóa Unicode, chữ hoa, ký tự vô hình, số thay chữ, chữ lặp và dấu chèn giữa ký tự.
- So khớp ranh giới từ, không tìm chuỗi con tùy tiện. Những âm tiết dễ nhầm với từ thông thường được giữ phân biệt dấu. Có ngoại lệ cho cụm chỉ quả/hạt/cây/sữa óc chó.
- Không cấm riêng các từ như “mày”, “tao”, “ngu”, “chó”, “đi”, “lớn”, “buổi”, “các”. Viết tắt ngắn vẫn có thể đa nghĩa; bộ lọc quy tắc không hiểu toàn bộ ngữ cảnh hay mọi cách né lọc. Thêm ca kiểm thử khi điều chỉnh từ vựng.

## Nguồn tham khảo

Tra cứu ngày 12/11/2026, tham khảo chọn lọc các nhóm từ và biến thể từ [Vietnamese Offensive Words](https://github.com/blue-eyes-vn/vietnamese-offensive-words) của Blue Eyes, MIT. Không nhập toàn bộ danh sách vì có nhiều từ có nghĩa thông thường. Bản quyền và giấy phép giữ tại [licenses/vietnamese-offensive-words.txt](licenses/vietnamese-offensive-words.txt).

## Cập nhật Ubuntu

Chạy trong repo hiện có. Không dùng GitHub Actions để triển khai. Sao lưu SQLite bằng SQLite backup API trước khi cập nhật; không chép riêng file SQLite đang chạy vì còn WAL.

```sh
cd ~/midnight-letters
python3 - <<'PY'
import sqlite3, datetime
from pathlib import Path
p = Path.home()/'.local/share/midnight-letters/midnight.sqlite'
if not p.exists():
    raise SystemExit('Không tìm thấy DB mặc định; kiểm tra MIDNIGHT_DATA_DIR của service trước.')
backup = p.with_name('midnight-before-admin-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.sqlite')
with sqlite3.connect(p) as src, sqlite3.connect(backup) as dest:
    src.backup(dest)
backup.chmod(0o600)
print('Đã sao lưu:', backup)
PY
git pull --ff-only
npm test
npm run build
sudo cp -a dist/. /var/www/html/
systemctl --user restart midnight-api.service
systemctl --user status midnight-api.service --no-pager
```

Nếu dùng service hệ thống hoặc `MIDNIGHT_DATA_DIR` khác, thay lệnh restart/đường dẫn sao lưu theo cấu hình đang chạy. Không xóa thư mục dữ liệu. Nginx vẫn chuyển `/api/` tới `127.0.0.1:8787`; không cần đổi tunnel hay build iOS/Android.
