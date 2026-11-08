-- A coller dans l'ANCIEN projet > SQL Editor > Run, puis Export > JSON, et m'envoyer le fichier.
-- (Sert a comparer le texte exact de 22 fonctions : rien n'est modifie.)
SELECT jsonb_pretty(jsonb_object_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', p.prosrc))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('_check_acces','_strate_sans_prix','check_compte_valide','check_comptes',
 'check_est_membre','check_note_controle','check_projet_createur','check_vider_corbeille','format_delete_material',
 'format_save_material','historique_annuler','historique_diff','historique_libelle','historique_lire','historique_log',
 'historique_peut_annuler','historique_tables','is_admin','stats_accueil','strate_delete_item','strate_lire','strate_save_item');
