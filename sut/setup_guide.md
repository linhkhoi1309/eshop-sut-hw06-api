# Hướng dẫn Cài đặt & Khởi chạy EShop (System Under Test)

Hệ thống EShop bao gồm 3 phân hệ chính: Backend API, Frontend Web và Frontend Mobile. Để kiểm thử toàn bộ hệ thống, bạn cần khởi chạy Backend và ít nhất một trong hai nền tảng Frontend.

## Yêu cầu Hệ thống (Prerequisites)
- Đã cài đặt **Node.js** (Phiên bản >= 18.x).
- Đã cài đặt trình quản lý gói `npm` (thường đi kèm với Node.js).
- (Tùy chọn) Ứng dụng **Expo Go** trên điện thoại (iOS/Android) nếu muốn chạy Frontend Mobile trên thiết bị thật.

---

## 1. Khởi chạy Backend API

Backend cung cấp dữ liệu và xử lý logic cho toàn bộ hệ thống.

1. Mở Terminal (Command Prompt / PowerShell / Terminal).
2. Di chuyển vào thư mục `backend`:
   ```bash
   cd EShop/backend
   ```
3. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
4. Khởi tạo cơ sở dữ liệu và dữ liệu mẫu (Seed Data). Chỉ cần chạy lệnh này một lần ở lần đầu tiên hoặc khi muốn reset dữ liệu:
   ```bash
   node database.js
   ```
5. Khởi chạy server:
   ```bash
   node server.js
   ```
   *Terminal sẽ thông báo: `Server is running on http://localhost:3000`.*
   *(Lưu ý: Bạn phải để Terminal này chạy liên tục trong suốt quá trình test).*

---

## 2. Khởi chạy Frontend Web

Frontend Web là giao diện chính để người dùng mua sắm qua trình duyệt.

1. Mở một cửa sổ Terminal MỚI.
2. Di chuyển vào thư mục `frontend-web`:
   ```bash
   cd EShop/frontend-web
   ```
3. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
4. Khởi chạy ứng dụng Web:
   ```bash
   npm run dev
   ```
   *Terminal sẽ cung cấp một đường link (ví dụ: `http://localhost:5173/`). Bạn hãy bấm vào hoặc copy dán vào trình duyệt để sử dụng.*

---

## 3. Khởi chạy Frontend Mobile (Expo)

Frontend Mobile cung cấp giao diện App trên điện thoại. (Lưu ý: Backend phải đang chạy ở bước 1).

1. Mở một cửa sổ Terminal MỚI.
2. Di chuyển vào thư mục `frontend-mobile`:
   ```bash
   cd EShop/frontend-mobile
   ```
3. Cài đặt các thư viện:
   ```bash
   npm install
   ```
4. Khởi chạy Metro Bundler của Expo:
   ```bash
   npx expo start
   ```
5. **Cách chạy App:**
   - Một mã QR Code sẽ hiện ra trên Terminal.
   - Sử dụng điện thoại tải app **Expo Go** (từ App Store hoặc Google Play).
   - Mở Expo Go và chọn quét mã QR (Scan QR Code) để mở ứng dụng.
   - *Lưu ý: Điện thoại và Máy tính phải dùng chung một mạng Wi-Fi.*
   
   *(Đối với máy ảo/Emulator, bạn có thể bấm phím `a` để mở trên Android Emulator hoặc `i` để mở trên iOS Simulator nếu đã cài đặt).*

---

## 4. Khởi chạy Web Admin (Dành cho Quản trị viên)

Đây là phân hệ Web mới được bổ sung trong Giai đoạn 2.

1. Mở một cửa sổ Terminal MỚI.
2. Di chuyển vào thư mục `frontend-admin`:
   ```bash
   cd EShop/frontend-admin
   ```
3. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
4. Khởi chạy ứng dụng Web Admin:
   ```bash
   npm run dev
   ```
   *Terminal sẽ cung cấp đường link `http://localhost:5174/`. Để đăng nhập, hãy sử dụng tài khoản Admin mặc định:*
   - **Email**: `admin@eshop.com`
   - **Mật khẩu**: `admin123`

---

## Hướng dẫn Kiểm thử

- Hãy bám sát vào tài liệu **Đặc tả Yêu cầu Hệ thống (System Requirements Specification)** để đối chiếu.
- Hệ thống này **CỐ Ý** được thiết kế chứa nhiều lỗi (bugs) liên quan đến:
  - Giao diện (UI/UX)
  - Xác thực dữ liệu (Form Validation)
  - Lỗ hổng bảo mật (SQL Injection, XSS, Phân quyền)
  - Lỗi Logic nghiệp vụ (Giỏ hàng, Thanh toán).
- Hãy cố gắng tìm ra càng nhiều lỗi càng tốt và ghi chép lại đầy đủ các bước tái hiện (Steps to Reproduce) nhé! Chúc bạn test vui vẻ!
