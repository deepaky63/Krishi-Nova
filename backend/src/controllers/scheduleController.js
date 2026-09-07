import * as schedules from '../services/scheduleService.js';
import { success } from '../utils/response.js';

export const previewSchedule = async (req, res) => success(res, await schedules.preview(req.body));
export const createSchedule = async (req, res) => success(res, await schedules.createAndGenerate(req.body, req.user), 201);
export const listSchedules = async (req, res) => success(res, await schedules.list(req.query));
export const getSchedule = async (req, res) => success(res, await schedules.get(req.params.id));
export const getScheduleSlots = async (req, res) => success(res, await schedules.getSlots(req.params.id, req.query));
export const setScheduleStatus = async (req, res) => success(res, await schedules.setStatus(req.params.id, req.body.active, req.user));
