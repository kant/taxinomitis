(function () {

    angular
        .module('app')
        .controller('ProjectsController', ProjectsController);

    ProjectsController.$inject = [
        'authService',
        'projectsService',
        '$stateParams', '$translate', '$mdDialog'
    ];

    function ProjectsController(authService, projectsService, $stateParams, $translate, $mdDialog) {

        var vm = this;
        vm.authService = authService;

        vm.highlightId = $stateParams.id;

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            if (!errObj) {
                errObj = {};
            }
            vm[type].push({
                alertid : alertId++,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
        }


        var translatedStrings = {};
        $translate([
            'NEWPROJECT.WARNINGS.MLCRED-TEXT-NOKEYS',
            'NEWPROJECT.WARNINGS.MLCRED-TEXT-INVALID',
            'NEWPROJECT.WARNINGS.MLCRED-IMG-NOKEYS',
            'NEWPROJECT.WARNINGS.MLCRED-IMG-INVALID',
            'PROJECTS.WHOLE_CLASS_TITLE', 'PROJECTS.WHOLE_CLASS_NOTES'
        ]).then(function (translations) {
            translatedStrings = translations;
        });


        function displayApiKeyCheckWarning(warning) {
            console.log(warning);

            if (translatedStrings['NEWPROJECT.WARNINGS.' + warning.code]) {
                displayAlert('warnings', 409, {
                    message : translatedStrings['NEWPROJECT.WARNINGS.' + warning.code]
                });
            }
        }



        function checkApiKeys(profile, checkingProject) {
            if (profile.tenant !== 'session-users' &&
                (checkingProject.type === 'text' || checkingProject.type === 'images'))
            {
                checkingProject.isPlaceholder = true;

                projectsService.checkProjectCredentials(profile.tenant, checkingProject.type)
                    .then(function (support) {
                        checkingProject.isPlaceholder = false;
                        displayApiKeyCheckWarning(support);
                    })
                    .catch(function (supporterr) {
                        checkingProject.isPlaceholder = false;
                        displayApiKeyCheckWarning(supporterr);
                    });
            }
        }


        function refreshProjectsList(profile) {
            projectsService.getProjects(profile)
                .then(function (projects) {
                    vm.projects = projects;

                    for (var i = 0; i < vm.projects.length; i++) {
                        var project = vm.projects[i];

                        var labels = project.type === 'sounds' ?
                            project.labels.filter(function (label) {
                                return label !== '_background_noise_';
                            }) :
                            project.labels;

                        if (labels.length > 0) {
                            var summary = '';
                            switch (labels.length) {
                                case 1:
                                    summary = labels[0];
                                    break;
                                case 2:
                                    summary = labels[0] + ' or ' + labels[1];
                                    break;
                                case 3:
                                    summary = labels[0] + ', ' +
                                              labels[1] + ' or ' +
                                              labels[2];
                                    break;
                                default:
                                    summary = labels[0] + ', ' +
                                              labels[1] + ' or ' +
                                              (labels.length - 2) + ' other classes';
                                    break;
                            }
                            project.labelsSummary = summary;
                        }

                        if (vm.highlightId === project.id) {
                            checkApiKeys(profile, project);
                        }
                    }
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);
                });
        }


        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                refreshProjectsList(profile);
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        vm.deleteProject = function (ev, project) {
            var confirm = $mdDialog.confirm()
                .title('Are you sure?')
                .textContent('Do you want to delete ' + project.name + '? (This cannot be undone)')
                .ariaLabel('Confirm')
                .targetEvent(ev)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(
                function() {
                    project.isPlaceholder = true;
                    projectsService.deleteProject(project, vm.profile.user_id, vm.profile.tenant)
                        .then(function () {
                            var idx = findProjectIndex(project.id);
                            if (idx !== -1) {
                                vm.projects.splice(idx, 1);
                            }
                            else {
                                refreshProjectsList(vm.profile);
                            }
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        vm.shareProject = function (ev, project, state) {
            project.isPlaceholder = true;
            projectsService.shareProject(project, vm.profile.user_id, vm.profile.tenant, state)
                .then(function (newstate) {
                    project.isCrowdSourced = newstate;
                    project.isPlaceholder = false;
                })
                .catch(function (err) {
                    project.isPlaceholder = false;
                    displayAlert('errors', err.status, err.data);
                });
        };

        vm.displayCrowdSourcedInfo = function (ev) {
            ev.stopPropagation();
            ev.preventDefault();

            $mdDialog.show(
                $mdDialog.alert()
                  .clickOutsideToClose(true)
                  .title(translatedStrings['PROJECTS.WHOLE_CLASS_TITLE'])
                  .textContent(translatedStrings['PROJECTS.WHOLE_CLASS_NOTES'])
                  .ariaLabel(translatedStrings['PROJECTS.WHOLE_CLASS_TITLE'])
                  .ok('OK')
                  .targetEvent(ev)
              );
        };

        function findProjectIndex(id) {
            var len = vm.projects.length;
            for (var i = 0; i < len; i++) {
                if (vm.projects[i].id === id) {
                    return i;
                }
            }
            return -1;
        }

    }
}());
