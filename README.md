# Midnight Letters

**Thư gửi nơi chốn — một lời nhắn chỉ tìm thấy khi bạn đến gần.**

Ứng dụng web ưu tiên điện thoại, phong cách bản đồ đêm và giấy thư ấm áp. Hỗ trợ tiếng Việt / English, Google Maps và định vị thật.

## Chạy tại máy

Cần Node.js 22 trở lên. Phiên bản web không cần cài thư viện.

```sh
npm run build
npm run dev
# http://localhost:4173
npm test
```

## Đã có

- Bốn màn hình: Khám phá, Viết thư, Kỷ niệm, Cá nhân.
- Bản đồ Google tương tác, ghim thư và vị trí cùng vòng sai số.
- Chế độ trải nghiệm tách riêng GPS thật. Mở thư khi cách tối đa 100 m, sai số GPS tối đa 50 m và mẫu vị trí không quá 60 giây.
- Đăng nhập/đăng ký, lưu thư vào SQLite trên máy chủ; nhập thư cũ từ thiết bị.
- Admin xem và xóa thư có xác nhận; chống nhập lại thư đã xóa.
- Bộ lọc tiếng Việt/English, viết tắt và cách viết né lọc dùng chung ở giao diện và API. Xem [hướng dẫn quản trị và cập nhật Ubuntu](docs/MODERATION.md).
- Viết thư tại trạm đang chọn hoặc vị trí hiện tại.
- Lưu và đọc lại đầy đủ kỷ niệm, tìm kiếm, lọc chủ đề.
- Tiếng Việt / English, font Noto lưu cùng ứng dụng, giao diện responsive và safe area.
- Web app manifest, cấu hình Capacitor và CI kiểm tra build / logic vị trí.

## Google Maps

Trong Cá nhân → Bản đồ Google, nhập **browser API key**. Bật Maps JavaScript API và billing trong Google Cloud; đặt Websites restrictions cho origin triển khai (`https://ten-mien/*`) và API restrictions cho Maps JavaScript API. Bản đồ dùng Advanced Markers và `DEMO_MAP_ID`; thay map ID riêng trước khi phát hành.

Key chỉ giữ trong sessionStorage, không commit vào mã nguồn. Browser key xuất hiện trong yêu cầu phía khách theo thiết kế của Google; cần giới hạn API, website, quota và theo dõi chi phí. Dùng HTTPS khi kiểm tra GPS trên điện thoại. Không có key thì app ghi rõ bản đồ chưa kết nối và hiện nền minh họa.

## Cấu trúc

```text
src/app.js           Điều phối màn hình và tương tác
src/styles.css      Giao diện responsive
src/i18n.js         Tiếng Việt / English
src/maps.js         Adapter Google Maps
src/core/           Dữ liệu mẫu, lưu trữ, quy tắc khoảng cách
public/             Font, biểu tượng, manifest
scripts/            Build tĩnh và máy chủ phát triển
tests/              Kiểm tra điều kiện mở thư và ngôn ngữ
docs/               Lộ trình ứng dụng di động
```

## Giới hạn hiện tại

Có máy chủ tài khoản và SQLite (`scripts/server.mjs`, Node 22+), lưu thư theo tài khoản và trang quản trị. Chưa phân phối thư công khai giữa mọi tài khoản. Thư cũ chưa nhập lên máy chủ vẫn là dữ liệu cục bộ; xóa dữ liệu trình duyệt sẽ mất các bản cục bộ này. Nội dung mẫu nằm trong bundle: kiểm tra GPS phía khách chỉ phục vụ trải nghiệm, **không phải cơ chế bảo vệ nội dung**. GPS trình duyệt có thể bị giả lập.

Không có APK/IPA hoặc dự án native được build trong bản này. Xem [lộ trình iOS / Android](docs/MOBILE_ROADMAP.md).

## Quyền riêng tư

Khi lưu/nhập thư, ứng dụng gửi nội dung và tọa độ đặt thư lên máy chủ tài khoản. Admin có thể xem và xóa thư đã lưu. Khi bấm gợi ý AI, máy chủ gửi chủ đề và ngôn ngữ cho Gemini; không gửi mật khẩu hay toàn bộ kho thư. Khi dùng Google Maps, Google nhận các yêu cầu bản đồ. GPS chỉ bật sau thao tác người dùng và dừng khi chuyển app sang nền. Chỉ đặt thư tại nơi công cộng, an toàn, được phép tiếp cận.

Font Noto: xem `public/fonts/LICENSE.txt`. Mã ứng dụng chưa cấp giấy phép phân phối công khai.


## Midnight Atlas

Khám phá mở bằng Trái Đất tương tác: kéo để xoay, +/− để đổi kích thước, chọn cụm thư để đến bản đồ đường phố hiện có (MapLibre / OpenFreeMap). Không thêm thư mẫu hoặc đổi điều kiện GPS. Khi chưa có thư, Trái Đất không hiển thị ghim giả. Các chức năng tài khoản, quản trị, lọc nội dung, địa hình và tuyến đi bộ được giữ nguyên.

Three.js r160 và ảnh Trái Đất 2K được lưu cùng ứng dụng (~0.9 MB), không cần CDN cho chế độ toàn cầu. Chỉ vẽ lại khi tương tác, dừng khi ẩn trang hoặc chuyển màn hình; giới hạn pixel ratio trên điện thoại. Thiết bị không có WebGL dùng bản Canvas nhẹ và có nhãn rõ ràng. Đây là góc nhìn toàn cầu; độ chính xác tìm thư dùng bản đồ đường phố và GPS.

Nguồn và giấy phép ảnh: `/credits.html`. Solar System Scope, CC BY 4.0; ảnh đã được dev-Armaan/satellites thu nhỏ và chuyển mã. Không tích hợp dịch vụ theo dõi vệ tinh hoặc thương hiệu Watched.

Kiểm tra gồm tọa độ/quy chiếu ảnh, gom cụm qua kinh tuyến 180°, các kiểm tra sẵn có và giao diện desktop/390×844. Trình duyệt kiểm thử tắt WebGL nên chỉ xác minh trực quan được bản Canvas dự phòng; bản WebGL cần kiểm tra thêm trên thiết bị thật. Bản demo tĩnh không cung cấp API tài khoản; khi tự host cần giữ dịch vụ Node/SQLite hiện có.
