var title = "驗光儀";
var question = "驗光儀可測量眼睛的度數，請根據驗光儀測得度數，輸出近視狀況。";
var array = [
    ["度數<300", "輕度近視"],
    ["300≦度數<500", "中度近視"],
    ["500≦度數<800", "高度近視"],
    ["800≦度數", "病理性近視"]
]
var test_case = [
    {
        input: "200",
        output: "輕度近視",
        note: "度數200度，為輕度近視"
    }
]

$(document).ready(function(){
    $("#question_name").text("題目名稱："+title)
    $("#question_info").text(question);
    $("#example_testcase").append(
        '<tr>\
            <th style="width: 20%;">輸入</th>\
            <th style="width: 20%;">輸出</th>\
            <th style="width: 30%;">說明</th>\
        </tr>'
    )    
    for(let i=0;i<test_case.length;i++){
        $("#example_testcase").append(
            '<tr>\
                <td style="width: 20%;">'+test_case[i].input+'</td>\
                <td style="width: 20%;">'+test_case[i].output+'</td>\
                <td style="width: 30%;">'+test_case[i].note+'</td>\
            </tr>'
        )  
    }
    for(let i=0;i<array.length;i++){
        $("#array").append(
            '<tr>\
                <td style="width: 20%;">'+array[i][0]+'</td>\
                <td style="width: 20%;">'+array[i][1]+'</td>\
            </tr>'
        )  
    }
    
})