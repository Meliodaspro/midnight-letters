# Hướng phát triển iOS / Android

## Lựa chọn nền tảng

Giữ web app làm nền tảng đầu tiên. Capacitor là hướng tái sử dụng giao diện này trong iOS/Android; `capacitor.config.json` đã khai báo `webDir: dist`. Đây là cấu hình khởi đầu, chưa phải native build đã kiểm chứng. Bundle ID hiện là giá trị đề xuất, đổi theo tài khoản developer trước khi phát hành.

Khi bắt đầu giai đoạn native, kiểm tra phiên bản Capacitor ổn định và yêu cầu hệ điều hành trên tài liệu chính thức rồi cài:

```sh
npm install @capacitor/core @capacitor/ios @capacitor/android
npm install -D @capacitor/cli
npm run build
npx cap add ios
npx cap add android
npm run native:sync
npm run native:ios
npm run native:android
```

iOS cần macOS / Xcode và ký bằng tài khoản của chủ app. Android cần Android Studio / SDK. Bổ sung mô tả quyền vị trí, biểu tượng raster, splash screen và kiểm tra thiết bị thật. Nên chuyển định vị sang plugin native qua adapter; không hứa hỗ trợ nền chỉ bằng GPS trình duyệt. Ràng buộc Google Maps browser key cần điều chỉnh cho WebView, hoặc chuyển qua Maps SDK native với key riêng từng nền tảng; không bỏ giới hạn key để chữa lỗi.

## Các bước tiếp theo

1. **Dữ liệu thật:** tài khoản, cơ sở dữ liệu, phân quyền thư công khai / riêng tư, đồng bộ, ảnh đính kèm và sao lưu.
2. **Mở thư có kiểm soát:** máy chủ chỉ trả phần gợi mở khi chưa đủ điều kiện; gửi vị trí mới để đánh giá; xử lý sai số, giả GPS, spam và giới hạn truy cập. GPS không đủ để chứng minh tuyệt đối người dùng ở đúng chỗ.
3. **An toàn cộng đồng:** báo cáo thư, chặn người dùng, kiểm duyệt, hạn chế địa điểm nguy hiểm, quản lý xóa tài khoản / nội dung.
4. **Native:** điều hướng deep link, bộ đệm, quyền vị trí hợp lý, accessibility, thông báo khi có sự đồng ý; thử pin và mạng yếu.
5. **Phát hành:** chính sách quyền riêng tư, khai báo dữ liệu App Store / Play, ký ứng dụng, thử TestFlight / internal testing rồi mới phát hành.

## Nguyên tắc kiến trúc

- `core/location.js` là logic thuần có thể dùng lại trong native.
- `core/storage.js` là điểm thay thế localStorage bằng cơ sở dữ liệu / API.
- `maps.js` là ranh giới thay Google Maps JavaScript bằng bản đồ native.
- `i18n.js` tập trung ngôn ngữ; nội dung người dùng không tự dịch.
- Chế độ trải nghiệm là công cụ onboarding; không dùng để mở thư bị khóa trên máy chủ.
