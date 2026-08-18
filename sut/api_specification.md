# Tài liệu Đặc tả API (API Specification) — EShop

> **Mục đích:** Tài liệu này cung cấp danh sách và cách sử dụng các Backend API của hệ thống EShop.
> Sinh viên có thể sử dụng Postman, cURL hoặc các công cụ tương tự để tương tác với API nhằm phục vụ quá trình kiểm thử phần mềm.
> **Base URL:** `http://localhost:3000`

---

## 1. Authentication (Xác thực)

### 1.1 Đăng ký tài khoản
- **Endpoint:** `POST /api/register`
- **Body (JSON):**
  ```json
  {
    "name": "Nguyen Van A",
    "email": "test@domain.com",
    "password": "Password123!"
  }
  ```
- **Phản hồi thành công (200 OK):** `{"message": "User registered successfully", "id": 1}`

### 1.2 Đăng nhập
- **Endpoint:** `POST /api/login`
- **Body (JSON):**
  ```json
  {
    "email": "test@domain.com",
    "password": "Password123!"
  }
  ```
- **Phản hồi thành công (200 OK):** Trả về chuỗi JWT `token` và thông tin `user`.

### 1.3 Quên mật khẩu (Lấy OTP)
- **Endpoint:** `POST /api/forgot-password`
- **Body (JSON):**
  ```json
  {
    "email": "test@domain.com"
  }
  ```
- **Phản hồi thành công (200 OK):** `{"message": "Mã đặt lại mật khẩu đã được tạo", "resetToken": "123456"}`

### 1.4 Đặt lại mật khẩu
- **Endpoint:** `POST /api/reset-password`
- **Body (JSON):**
  ```json
  {
    "email": "test@domain.com",
    "resetToken": "123456",
    "newPassword": "NewPassword123!"
  }
  ```

---

## 2. Người dùng (Users)

*Lưu ý: Các API dưới đây yêu cầu truyền Token ở Header: `Authorization: Bearer <token>`*

### 2.1 Lấy thông tin cá nhân
- **Endpoint:** `GET /api/users/me`

### 2.2 Cập nhật hồ sơ cá nhân
- **Endpoint:** `PUT /api/users/me`
- **Mô tả:** Chỉ cho phép cập nhật thông tin cá nhân cơ bản.
- **Body (JSON):**
  ```json
  {
    "name": "Nguyen Van A",
    "shipping_address": "123 Le Loi, Q1, TP.HCM",
    "phone": "0912345678"
  }
  ```

---

## 3. Sản phẩm (Products) & Danh mục (Categories)

### 3.1 Lấy danh sách sản phẩm
- **Endpoint:** `GET /api/products`
- **Query string (Tùy chọn):** `?search=keyword` để tìm kiếm sản phẩm theo tên.

### 3.2 Xem chi tiết một sản phẩm
- **Endpoint:** `GET /api/products/:id`

### 3.3 Thêm / Sửa / Xóa Sản phẩm (Dành cho Admin)
- **Thêm sản phẩm:** `POST /api/products`
- **Cập nhật:** `PUT /api/products/:id`
- **Xóa:** `DELETE /api/products/:id`
- **Body khi Thêm/Sửa (JSON):**
  ```json
  {
    "name": "Tên sản phẩm",
    "price": 100000,
    "description": "Mô tả",
    "imageUrl": "http://...",
    "category_id": 1
  }
  ```

### 3.4 Danh mục (Categories)
- **Lấy danh sách:** `GET /api/categories`
- **Thêm mới:** `POST /api/categories` *(Body: `{"name": "Tên DM"}`)*
- **Cập nhật:** `PUT /api/categories/:id`
- **Xóa:** `DELETE /api/categories/:id`

---

## 4. Giỏ hàng & Đơn hàng (Cart & Orders)

*Yêu cầu Header: `Authorization: Bearer <token>`*

### 4.1 Lấy giỏ hàng
- **Endpoint:** `GET /api/cart`

### 4.2 Thêm vào giỏ hàng
- **Endpoint:** `POST /api/cart`
- **Body (JSON):** 
  ```json
  {
    "id": 1,
    "name": "Sản phẩm A",
    "price": 100000,
    "quantity": 2
  }
  ```

### 4.3 Đặt hàng (Checkout)
- **Endpoint:** `POST /api/checkout`
- **Body (JSON):**
  ```json
  {
    "total_amount": 200000,
    "shipping_address": "123 Le Loi, TP.HCM"
  }
  ```

### 4.4 Lấy lịch sử đơn hàng cá nhân
- **Endpoint:** `GET /api/orders/my-orders`

### 4.5 Lấy chi tiết một đơn hàng
- **Endpoint:** `GET /api/orders/:id`

### 4.6 Hủy đơn hàng
- **Endpoint:** `PUT /api/orders/:id/cancel`
- **Mô tả:** Chuyển trạng thái đơn hàng sang `canceled`. Chỉ được thực hiện khi đơn hàng chưa giao.

---

## 5. Mã Giảm Giá (Coupons)

### 5.1 Áp dụng mã giảm giá
- **Endpoint:** `POST /api/apply-coupon`
- **Mô tả:** Tính toán tổng tiền sau khi giảm. Trả về cấu trúc JSON chứa `discount_amount` và `final_amount`.
- **Body (JSON):**
  ```json
  {
    "code": "SAVE10",
    "total_amount": 500000,
    "user_id": 1
  }
  ```

### 5.2 Lấy danh sách mã giảm giá (Dành cho Admin)
- **Endpoint:** `GET /api/coupons`
- **Header:** `Authorization: Bearer <token>`

---

## 6. API Dành cho Admin

*Tất cả API dưới đây yêu cầu `Authorization: Bearer <token>` và tài khoản phải có quyền Admin.*

### 6.1 Quản lý Người dùng
- **Lấy danh sách người dùng:** `GET /api/admin/users`
- **Xóa người dùng:** `DELETE /api/admin/users/:id`

### 6.2 Quản lý Đơn hàng (Toàn hệ thống)
- **Lấy danh sách đơn hàng:** `GET /api/admin/orders`
- **Cập nhật trạng thái đơn hàng:** `PUT /api/admin/orders/:id/status`
  - **Body (JSON):** `{"status": "confirmed"}` (Các trạng thái: `pending`, `confirmed`, `shipping`, `delivered`, `canceled`).

### 6.3 Import Sản phẩm từ CSV (JSON Array)
- **Endpoint:** `POST /api/admin/import-products`
- **Body (JSON):**
  ```json
  {
    "products": [
      {
        "name": "SP 1",
        "price": 10000,
        "description": "Mô tả 1",
        "imageUrl": "",
        "category_id": 1
      }
    ]
  }
  ```

### 6.4 Quản lý Mã Giảm Giá
- **Thêm mới mã:** `POST /api/admin/coupons`
  - **Body (JSON):**
    ```json
    {
      "code": "TET2025",
      "type": "percent", 
      "discount_value": 15,
      "min_order_amount": 200000,
      "expired_at": "2025-01-31",
      "max_uses_per_user": 1
    }
    ```
- **Xóa mã:** `DELETE /api/admin/coupons/:id`
