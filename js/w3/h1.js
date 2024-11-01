var title = "養成遊戲";
var question = "遊戲中寵物會根據心情指數給予不同回應。請根據現在的心情，做出相對應的回應。\n";
var array = [
    ["心情", "回應"],
    ["80~100", "超開心"],
    ["60~79", "開心"],
    ["40~59", "普通"],
    ["0~39", "......"]
]
var test_case = [
    {
        input: "95",
        output: "超開心",
        note: "95在80~100之間，超開心"
    },
	{
        input: "75",
        output: "開心",
        note: "75在60~79之間，開心"
    },
    {
        input: "30",
        output: "......",
        note: "30在0~39之間，不理你"
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