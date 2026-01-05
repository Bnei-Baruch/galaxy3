import {kc} from "../components/UserManager";
import {AUDOUT_ID, QSTOUT_ID, SDIOUT_ID, SHIDUR_ID, SNDMAN_ID, STORAN_ID} from "./consts";

export const userRolesEnum = {
  none: null,
  ghost: "ghost",
  viewer: "viewer",
  new_user: "new_user",
  pending_approve: "pending_approve",
  user: "user",
};

export const getUserRole = () => {
  switch (true) {
    case kc.hasRealmRole("pending_approval"):
      return userRolesEnum.ghost;
    case kc.hasRealmRole("gxy_user"):
      return userRolesEnum.user;
    case kc.hasRealmRole("gxy_pending_approval"):
      return userRolesEnum.pending_approve;
    case kc.hasRealmRole("gxy_guest"):
      return userRolesEnum.viewer;
    case kc.hasRealmRole("new_user"):
      return userRolesEnum.new_user;
    default:
      return userRolesEnum.none;
  }
};

export const isServiceID = (id) => {
  return [SNDMAN_ID, SDIOUT_ID, QSTOUT_ID, STORAN_ID, AUDOUT_ID, "webout", "QSTOUT_ID", "SDIOUT_ID", "testwebout"].includes(id);
};
