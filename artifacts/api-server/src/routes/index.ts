import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { downloadRouter } from "./download";
import { adminRouter } from "./admin";
import { videoRouter } from "./video";
import { boostRouter } from "./boost";
import { musicRouter } from "./music";
import { animeRouter } from "./anime";
import { toolsRouter } from "./tools";
import { moviesRouter } from "./movies";
import { adultRouter } from "./adult";
import { feedRouter } from "./feed";

const router: IRouter = Router();

router.use(healthRouter);
router.use(downloadRouter);
router.use(adminRouter);
router.use(videoRouter);
router.use(boostRouter);
router.use(musicRouter);
router.use(animeRouter);
router.use(toolsRouter);
router.use(moviesRouter);
router.use(adultRouter);
router.use(feedRouter);

export default router;
