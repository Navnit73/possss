import SwalBase from "sweetalert2";

/**
 * SweetAlert2 pre-skinned onto the Apple design system: pill buttons in Action Blue,
 * the secondary "ghost pill" for cancel, and no inline button colors.
 * Import this instead of "sweetalert2" so every dialog stays on-system.
 */
export const Swal = SwalBase.mixin({
  buttonsStyling: false,
  reverseButtons: true,
  customClass: {
    confirmButton: "swal-btn swal-btn-primary",
    cancelButton: "swal-btn swal-btn-secondary",
    denyButton: "swal-btn swal-btn-secondary",
  },
});

/** Pass as `customClass` for destructive confirmations (delete, cancel subscription, void). */
export const destructiveSwalClasses = {
  confirmButton: "swal-btn swal-btn-destructive",
  cancelButton: "swal-btn swal-btn-secondary",
  denyButton: "swal-btn swal-btn-secondary",
};

export default Swal;
