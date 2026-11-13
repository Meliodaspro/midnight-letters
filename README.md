# Midnight Letters

**Thư gửi nơi chốn — một lời nhắn chỉ tìm thấy khi bạn đến gần.**

Ứng dụng web ưu tiên điện thoại, phong cách bản đồ đêm và giấy thư ấm áp. Hỗ trợ tiếng Việt / English, MapLibre / OpenFreeMap và định vị thật.

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
- Bản đồ MapLibre tương tác, ghim thư và vị trí cùng vòng sai số.
- Dùng GPS thật. Mở thư khi cách tối đa 100 m, sai số GPS tối đa 50 m và mẫu vị trí không quá 60 giây.
- Đăng nhập/đăng ký, lưu thư vào SQLite trên máy chủ; nhập thư cũ từ thiết bị.
- Admin xem và xóa thư có xác nhận; chống nhập lại thư đã xóa.
- Bộ lọc tiếng Việt/English, viết tắt và cách viết né lọc dùng chung ở giao diện và API. Xem [hướng dẫn quản trị và cập nhật Ubuntu](docs/MODERATION.md).
- Viết thư tại trạm đang chọn hoặc vị trí hiện tại.
- Lưu và đọc lại đầy đủ kỷ niệm, tìm kiếm, lọc chủ đề.
- Tiếng Việt / English, font Noto lưu cùng ứng dụng, giao diện responsive và safe area.
- Web app manifest, cấu hình Capacitor và CI kiểm tra build / logic vị trí.

## Bản đồ miễn phí

Dùng MapLibre GL JS 5.6.2 (BSD-3-Clause) và OpenFreeMap/OpenStreetMap, không cần API key, tài khoản bản đồ hay billing. SDK được lưu cùng ứng dụng trong `public/vendor/maplibre`. Dữ liệu đường phố cần kết nối tới `tiles.openfreemap.org` và các máy chủ font/sprite được khai báo trong style của dịch vụ. Giữ phần ghi nguồn trên bản đồ.

Khám phá dùng **một canvas và một camera** từ toàn cầu xuống đường phố. Cuộn/chụm hai ngón để zoom, bấm Khám phá mặt đất để bay tới thư đang chọn, vị trí GPS hoặc tâm bản đồ; bấm Trái Đất để trở lại toàn cầu. Góc nhìn globe tự chuyển dần sang mặt phẳng khi zoom gần. Các khối tòa nhà xuất hiện ở nơi OpenStreetMap có dữ liệu, không phải mô hình nhà chụp ảnh như Google Earth.

Ở xa, app dùng 21 tile Trái Đất có mây được lưu sẵn (zoom 0–2). Ảnh được chuyển dần sang bản đồ vector ở zoom 3–5.5, không phóng ảnh bề mặt mờ xuống tận đường phố. Đây là ảnh toàn cầu và bản đồ đường phố, không phải ảnh vệ tinh độ phân giải cao mọi cấp zoom. Ảnh ngày và mây tĩnh, không thể hiện thời tiết trực tiếp.

Cần WebGL 2 để dùng bản đồ liền mạch. Nếu thiếu WebGL hoặc mất mạng/dữ liệu bản đồ, app hiện thông báo và nút thử lại; góc nhìn nhẹ chỉ xem quả cầu, không giả lập khả năng zoom tới mặt đất. SDK cũ và shader Watched vẫn được lưu cho chế độ dự phòng; bản đồ chính dùng MapLibre.

Chức năng địa hình và tuyến đi bộ hiện có được giữ nguyên, dùng các nguồn mở đã cấu hình. Dùng HTTPS để kiểm tra GPS trên điện thoại. Không thay đổi database hay điều kiện mở thư.

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


## Dữ liệu và kiểm tra Atlas

- `src/core/atlas.js`: projection globe, lớp ảnh chuyển tiếp và các đích camera.
- `src/maps.js`: một instance MapLibre cho cả thế giới/đường phố, zoom và chuyến bay.
- `public/earth-tiles`: tile Web Mercator đã dựng từ ảnh Solar System Scope (CC BY 4.0), có ghép mây tĩnh. Nguồn texture đã được dự án Watched thu nhỏ/chuyển mã; Midnight tái chiếu và ghép mây. Ghi nguồn tại `/credits.html`.
- `scripts/build-earth-tiles.py`: chỉ dùng khi muốn tạo lại tài nguyên; cần Pillow/numpy. Chạy `npm run build` thông thường không cần Python và không tải tile hàng loạt từ dịch vụ bên ngoài.
- `npm test`: điều kiện mở thư, ngôn ngữ, quản trị/lọc nội dung, tọa độ/hướng Mặt Trời và kiểm tra Atlas. Kiểm tra adapter xác nhận chỉ tạo một map khi chuyển từ toàn cầu xuống địa điểm và quay lại, bằng SDK giả lập; không thay thế việc kiểm tra dựng GPU.

Trình duyệt kiểm thử tắt WebGL 2 nên chưa xác minh trực quan được chuyến bay và các tile vector trên GPU. Đã kiểm tra giao diện dự phòng desktop/điện thoại; cần kiểm tra tiếp trên trình duyệt có tăng tốc phần cứng.
