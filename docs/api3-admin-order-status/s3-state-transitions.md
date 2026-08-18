# Stage S3: State Transitions for API 3 (`PUT /api/admin/orders/:id/status`)

**Spec quoted:** FR-10 — the 5-state machine, drawn forward diagram (`pending` → `confirmed` →
`shipping` → `delivered`, with cancel arrows from `pending` and `confirmed`), plus: "Trạng thái
`delivered` và `canceled` là **trạng thái kết thúc** — không được phép chuyển sang bất kỳ trạng thái
nào khác. Khi đơn hàng đã ở trạng thái `shipping`, **User không được phép tự hủy** — chỉ **Admin**
mới có thể thao tác. Mọi chuyển đổi không hợp lệ phải trả về lỗi với thông báo phù hợp." Since this
endpoint *is* the Admin path, the `shipping`-cancel restriction is a restriction on the *User*-facing
`PUT /api/orders/:id/cancel` endpoint, not on this one — for `PUT /api/admin/orders/:id/status`,
`shipping → canceled` is spec-legal.

**Full 5×5 transition matrix.** An N-state machine has N×N rows; every cell below is a distinct case,
including the ones that must be rejected and the ones that target a final state. Per the generator's
own known failure mode #3 ("final states are not tested"), the 10 rows whose "from" state is
`delivered` or `canceled` are exactly where a planted defect is most likely to hide undetected.

| ID | From → To | Expected | Spec Justification |
|---|---|---|---|
| A3-S3-01 | `pending` → `pending` | UNDETERMINED | Spec doesn't address same-state re-submission |
| A3-S3-02 | `pending` → `confirmed` | 200 (legal) | FR-10 diagram: "[Admin xác nhận]" arrow |
| A3-S3-03 | `pending` → `shipping` | 400 (illegal) | No direct arrow; skips `confirmed` |
| A3-S3-04 | `pending` → `delivered` | 400 (illegal) | No direct arrow; skips two states |
| A3-S3-05 | `pending` → `canceled` | 200 (legal) | FR-10 diagram: cancel arrow from `pending` |
| A3-S3-06 | `confirmed` → `pending` | 400 (illegal) | No backward arrow anywhere in the diagram |
| A3-S3-07 | `confirmed` → `confirmed` | UNDETERMINED | Spec doesn't address same-state re-submission |
| A3-S3-08 | `confirmed` → `shipping` | 200 (legal) | FR-10 diagram: "[Admin giao hàng]" arrow |
| A3-S3-09 | `confirmed` → `delivered` | 400 (illegal) | No direct arrow; skips `shipping` |
| A3-S3-10 | `confirmed` → `canceled` | 200 (legal) | FR-10 diagram: cancel arrow from `confirmed` |
| A3-S3-11 | `shipping` → `pending` | 400 (illegal) | No backward arrow |
| A3-S3-12 | `shipping` → `confirmed` | 400 (illegal) | No backward arrow |
| A3-S3-13 | `shipping` → `shipping` | UNDETERMINED | Spec doesn't address same-state re-submission |
| A3-S3-14 | `shipping` → `delivered` | 200 (legal) | FR-10 diagram: "[Admin hoàn tất]" arrow |
| A3-S3-15 | `shipping` → `canceled` | 200 (legal, admin-only) | FR-10: "chỉ Admin mới có thể thao tác" — this endpoint is the Admin path, so the restriction that blocks the *User* endpoint does not apply here |
| A3-S3-16 | `delivered` → `pending` | 400 (illegal — final state) | FR-10: `delivered` "không được phép chuyển sang bất kỳ trạng thái nào khác" |
| A3-S3-17 | `delivered` → `confirmed` | 400 (illegal — final state) | Same |
| A3-S3-18 | `delivered` → `shipping` | 400 (illegal — final state) | Same |
| A3-S3-19 | `delivered` → `delivered` | 400 (illegal — final state, strict reading) | "không được phép chuyển sang bất kỳ trạng thái nào khác" read as: no PUT succeeds from a final state, same-state included |
| A3-S3-20 | `delivered` → `canceled` | 400 (illegal — final state) | Same |
| A3-S3-21 | `canceled` → `pending` | 400 (illegal — final state) | FR-10: `canceled` is equally final |
| A3-S3-22 | `canceled` → `confirmed` | 400 (illegal — final state) | Same |
| A3-S3-23 | `canceled` → `shipping` | 400 (illegal — final state) | Same |
| A3-S3-24 | `canceled` → `delivered` | 400 (illegal — final state) | Same — **the single most spec-unambiguous illegal transition in the matrix**: `canceled` is explicitly final, and this specific arrow (resurrecting a canceled order as delivered) has no drawn path anywhere in FR-10's diagram |
| A3-S3-25 | `canceled` → `canceled` | 400 (illegal — final state, strict reading) | Same reasoning as A3-S3-19 |

---

**Coverage floor check:** all 25 cells of the 5×5 matrix are present — every "from" state pairs with
every "to" state, including both final states' full row (10 of the 25 rows target-from a final
state) and the 5 same-state cells the diagram doesn't draw at all.
