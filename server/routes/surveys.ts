import { Router } from 'express';
import { LIMITS } from '../../shared/constants';
import { one, run, tx, type DB } from '../db';
import { badRequest, forbidden, HttpError, notFound, paramId, parse, requireUser } from '../http';
import { notify } from '../notify';
import { canView, getZooRow, loadSurveys } from '../queries';
import { suggestionInput, surveyUpdateInput, voteInput } from '../schemas';

interface SurveyRow {
  id: number;
  zoo_id: number;
  is_open: number;
  allow_suggestions: number;
}

export function surveyRoutes(db: DB) {
  const r = Router();

  const findSurvey = (id: number, viewerId: number | undefined) => {
    const survey = one<SurveyRow>(db, 'SELECT id, zoo_id, is_open, allow_suggestions FROM surveys WHERE id = ?', id);
    const zoo = survey && getZooRow(db, survey.zoo_id);
    if (!survey || !zoo || !canView(zoo, viewerId)) throw notFound('Survey not found');
    return { survey, zoo };
  };

  const ownSurvey = (id: number, viewerId: number) => {
    const found = findSurvey(id, viewerId);
    if (found.zoo.owner_id !== viewerId) throw forbidden('Only the park owner can manage this survey');
    return found;
  };

  const requireOpen = (survey: SurveyRow) => {
    if (!survey.is_open) throw new HttpError(409, 'This survey is closed');
  };

  const respond = (surveyId: number, zoo: ReturnType<typeof findSurvey>['zoo'], viewerId: number) =>
    loadSurveys(db, zoo, viewerId, surveyId)[0];

  r.post('/:id/vote', (req, res) => {
    const me = requireUser(req);
    const { survey, zoo } = findSurvey(paramId(req), me.id);
    requireOpen(survey);
    const { optionId } = parse(voteInput, req.body);
    if (!one(db, 'SELECT 1 FROM survey_options WHERE id = ? AND survey_id = ?', optionId, survey.id)) throw badRequest('That option is not part of this survey');
    run(
      db,
      `INSERT INTO survey_votes (survey_id, user_id, option_id) VALUES (?, ?, ?)
       ON CONFLICT (survey_id, user_id) DO UPDATE SET option_id = excluded.option_id`,
      survey.id,
      me.id,
      optionId,
    );
    res.json(respond(survey.id, zoo, me.id));
  });

  r.delete('/:id/vote', (req, res) => {
    const me = requireUser(req);
    const { survey, zoo } = findSurvey(paramId(req), me.id);
    requireOpen(survey);
    run(db, 'DELETE FROM survey_votes WHERE survey_id = ? AND user_id = ?', survey.id, me.id);
    res.json(respond(survey.id, zoo, me.id));
  });

  // Suggest a new option (when the owner allows it); your vote moves to your suggestion.
  r.post('/:id/options', (req, res) => {
    const me = requireUser(req);
    const { survey, zoo } = findSurvey(paramId(req), me.id);
    requireOpen(survey);
    const isOwner = zoo.owner_id === me.id;
    if (!survey.allow_suggestions && !isOwner) throw forbidden('This survey does not take suggestions');
    const { label } = parse(suggestionInput, req.body);
    const existing = one<{ id: number }>(db, 'SELECT id FROM survey_options WHERE survey_id = ? AND label = ? COLLATE NOCASE', survey.id, label);
    const count = one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM survey_options WHERE survey_id = ?', survey.id)!.n;
    if (!existing && count >= LIMITS.surveyOptionsMax) throw badRequest('This survey already has the maximum number of options');
    tx(db, () => {
      const optionId = existing?.id ?? run(db, 'INSERT INTO survey_options (survey_id, label, suggested_by) VALUES (?, ?, ?)', survey.id, label, isOwner ? null : me.id).id;
      if (!existing && !isOwner) notify(db, { userId: zoo.owner_id, actorId: me.id, type: 'suggestion', surveyId: survey.id, data: { label } });
      if (!isOwner) {
        run(
          db,
          `INSERT INTO survey_votes (survey_id, user_id, option_id) VALUES (?, ?, ?)
           ON CONFLICT (survey_id, user_id) DO UPDATE SET option_id = excluded.option_id`,
          survey.id,
          me.id,
          optionId,
        );
      }
    });
    res.status(201).json(respond(survey.id, zoo, me.id));
  });

  r.delete('/:id/options/:optionId', (req, res) => {
    const me = requireUser(req);
    const { survey, zoo } = ownSurvey(paramId(req), me.id);
    const optionId = paramId(req, 'optionId');
    const count = one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM survey_options WHERE survey_id = ?', survey.id)!.n;
    if (count <= LIMITS.surveyOptionsMin) throw badRequest('A survey needs at least two options');
    const { changes } = run(db, 'DELETE FROM survey_options WHERE id = ? AND survey_id = ?', optionId, survey.id);
    if (!changes) throw notFound('Option not found');
    res.json(respond(survey.id, zoo, me.id));
  });

  r.patch('/:id', (req, res) => {
    const me = requireUser(req);
    const { survey, zoo } = ownSurvey(paramId(req), me.id);
    const { isOpen } = parse(surveyUpdateInput, req.body);
    run(db, 'UPDATE surveys SET is_open = ? WHERE id = ?', isOpen ? 1 : 0, survey.id);
    res.json(respond(survey.id, zoo, me.id));
  });

  r.delete('/:id', (req, res) => {
    const me = requireUser(req);
    const { survey } = ownSurvey(paramId(req), me.id);
    run(db, 'DELETE FROM surveys WHERE id = ?', survey.id);
    res.json({ ok: true });
  });

  return r;
}
