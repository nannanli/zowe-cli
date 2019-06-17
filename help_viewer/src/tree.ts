/*
* This program and the accompanying materials are made available under the terms of the
* Eclipse Public License v2.0 which accompanies this distribution, and is available at
* https://www.eclipse.org/legal/epl-v20.html
*
* SPDX-License-Identifier: EPL-2.0
*
* Copyright Contributors to the Zowe Project.
*
*/

interface ITreeNode {
    id: string;
    text: string;
    children: undefined | ITreeNode[];
}

declare const treeNodes: ITreeNode[];
declare const aliasList: { [key: string]: string[] };
declare const headerStr: string;
declare const footerStr: string;

let currentNodeId: string = null;
let isFlattened: boolean = false;
let searchStrList: string[] = [];
let searchTimeout: number = 0;

function searchTree(_: string, node: any): boolean {
    if ((node.parent === "#") && !isFlattened) {
        return false;  // Don't match root node
    }

    const fullCmd: string = node.id.slice(0, -5).replace(/_/g, " ");
    for (const searchStr of searchStrList) {
        const matchIndex: number = fullCmd.indexOf(searchStr);
        if (matchIndex !== -1) {
            if (isFlattened || (fullCmd.indexOf(" ", matchIndex + searchStr.length) === -1)) {
                return true;
            }
        }
    }

    return false;
}

function permuteSearchStr(searchStr: string): string[] {
    const searchWords: string[] = searchStr.split(" ");
    const searchWordsList: string[][] = [searchWords];

    for (let i = 0; i < searchWords.length; i++) {
        const word = searchWords[i];

        if (aliasList[word] !== undefined) {
            const newSearchWordsList: string[][] = [];
            searchWordsList.forEach((oldSearchWords: string[]) => {
                aliasList[word].forEach((alias: string) => {
                    newSearchWordsList.push([...oldSearchWords.slice(0, i), alias, ...oldSearchWords.slice(i + 1)]);
                });
            });
            searchWordsList.push(...newSearchWordsList);
        }
    }

    return searchWordsList.map((words: string[]) => words.join(" "));
}

function selectCurrentNode(alsoExpand: boolean) {
    $("#cmd-tree").jstree(true).deselect_all();
    $("#cmd-tree").jstree(true).select_node(currentNodeId);

    if (alsoExpand) {
        $("#cmd-tree").jstree(true).open_node(currentNodeId);
    }

    const node = document.getElementById(currentNodeId);
    if (node !== null) {
        node.scrollIntoView();
    }
}

function updateSearch() {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
        let searchStr = $("#tree-search").val().toString().trim();
        const rootName = treeNodes[0].text;

        if (searchStr.startsWith(`${rootName} `)) {
            searchStr = searchStr.slice(rootName.length).trim();
        }

        searchStrList = permuteSearchStr(searchStr);
        $("#cmd-tree").jstree(true).search(searchStr);
    }, 250);
}

function genFlattenedNodes(nestedNodes: ITreeNode[]): ITreeNode[] {
    const flattenedNodes: ITreeNode[] = [];

    nestedNodes.forEach((node: ITreeNode) => {
        if (node.children && (node.children.length > 0)) {
            flattenedNodes.push(...genFlattenedNodes(node.children));
        } else {
            const nodeText = node.id.slice(0, -5).replace(/_/g, " ");
            flattenedNodes.push({
                id: node.id,
                text: `${treeNodes[0].text} ${nodeText}`,
                children: undefined
            });
        }
    });

    return flattenedNodes;
}

function loadTree() {
    const urlParams = new URLSearchParams(window.location.search);
    $("#header-text").text(headerStr);
    $("#footer").text(footerStr);

    $("#cmd-tree").jstree({
        core: {
            animation: 0,
            multiple: false,
            themes: {
                icons: false
            },
            data: treeNodes
        },
        plugins: ["search", "wholerow"],
        search: {
            show_only_matches: true,
            show_only_matches_children: true,
            search_callback: searchTree
        },
    }).on("changed.jstree", (e, data) => {
        // Change src attribute of iframe when item selected
        if (data.selected.length > 0) {
            currentNodeId = data.selected[0];
            $("#docs-page").attr("src", `cmd_docs/${currentNodeId}?e=1`);
        }
    }).on("loaded.jstree", () => {
        // Select and expand root node when page loads
        const nodeId = urlParams.get("p");
        currentNodeId = (nodeId === null) ? treeNodes[0].id : `${nodeId}.html`;
        selectCurrentNode(true);
    });

    if (urlParams.get("l") === "1") {
        toggleTreeView();
    }

    $("#tree-search").on("change keyup mouseup paste", updateSearch);

    window.addEventListener("message", (e) => {
        currentNodeId = e.data.split("/").slice(-1)[0];
        selectCurrentNode(false);
    }, false);
}

function toggleTree(splitter: any) {
    if ($("#panel-left").is(":visible")) {
        $("#panel-left").children().hide();
        $("#panel-left").hide();
        splitter.setSizes([0, 100]);
    } else {
        splitter.setSizes([20, 80]);
        $("#panel-left").show();
        $("#panel-left").children().show();
    }
}

function toggleTreeView() {
    isFlattened = !isFlattened;
    const newNodes = isFlattened ? genFlattenedNodes(treeNodes) : treeNodes;
    ($("#cmd-tree").jstree(true) as any).settings.core.data = newNodes;
    $("#cmd-tree").jstree(true).refresh(false, true);
    setTimeout(() => selectCurrentNode(true), 250);
    const otherViewName = isFlattened ? "Tree View" : "List View";
    $("#tree-view-toggle").text(`Switch to ${otherViewName}`);
    $("#tree-expand-all").toggle();
    $("#tree-collapse-all").toggle();
}

function expandAll(expanded: boolean) {
    if (expanded) {
        $("#cmd-tree").jstree("open_all");
    } else {
        $("#cmd-tree").jstree("close_all");
        $("#cmd-tree").jstree(true).toggle_node(treeNodes[0].id);
    }
}