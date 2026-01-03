import express from "express";
import { authorizeRoles, protect } from "../middlewares/authMiddleware.js";
import { trainerBootstrap, getTrainerBatchDetails, toggleSectionCompletion, getTrainerCourses, getTrainerprofile, updateTrainerprofile } from "../controllers/trainerController.js";


const router = express.Router();
router.get("/trainer-summary", protect, authorizeRoles("trainer"), trainerBootstrap);
router.get("/trainer-batch-details/:batchId", protect, authorizeRoles("trainer"), getTrainerBatchDetails);
router.post("/trainer-section-complete", protect, authorizeRoles("trainer"), toggleSectionCompletion);
router.get("/trainer-courses", protect, authorizeRoles("trainer"), getTrainerCourses);
router.get("/trainer-profile", protect, authorizeRoles("trainer"), getTrainerprofile);
router.put("/trainer-profile", protect, authorizeRoles("trainer"), updateTrainerprofile);

export default router; 

/*
router.get("/bootstrap", auth, isTrainer, trainerBootstrap);
router.get("/batch/:batchId", auth, isTrainer, getTrainerBatchDetails);
router.post("/batch/section/complete", auth, isTrainer, markSectionComplete);
router.get("/my-courses", auth, isTrainer, getTrainerCourses);
router.get("/profile", auth, isTrainer, getTrainerProfile);
router.put("/profile", auth, isTrainer, updateTrainerProfile);

*/